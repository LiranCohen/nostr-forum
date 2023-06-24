import { Event, verifySignature, Kind, Filter } from 'nostr-tools'
import React, { useEffect, useMemo, useState } from 'react'
import { Note } from '../note/note'
import { Connection, hashSub } from '../connection/connection'
import Dexie from 'dexie'

interface Subscription extends Filter {}
const DEFAULT_RELAY = "wss://grove-relay.onrender.com"

interface EventConsumer {
  onEvent: (event: Event) => void
}

interface EventRelayInfo {
  available: boolean
  lastChecked: number
}

interface EventTrack {
  event: Event
  relays: Map<string, EventRelayInfo>
}

class EventDatabase extends Dexie {
  private events: Dexie.Table<EventTrack, string>;  // id is the primary key
  private consumers: Map<string, EventConsumer>

  constructor() {
      super('Events');
      this.version(1).stores({
          events: 'id,pubkey,kind,tags,content,created_at',
      });
      this.events = this.table('events');
      this.consumers = new Map()
  }

  async sub(sub: Filter, consumer: EventConsumer) {
    const hash = await hashSub([sub])
    this.consumers.set(hash, consumer)
  }

  async unsub(subId:string) {
    this.consumers.delete(subId)
  }

  async addEvent(subId: string, event: Event, relayURL: string) {
    try {
      const tracker = await this.events.get(event.id)
      if(tracker) {
        tracker?.relays.set(relayURL, {
          available: true,
          lastChecked: Math.floor(new Date().getTime() / 1000),  
        })
        this.events.put(tracker, event.id)
      }
    } catch(error) {
      const relayInfo = {
        available: true,
        lastChecked: Math.floor(new Date().getTime() / 1000),  
      }
      await this.events.add({
        event,
        relays: new Map([[relayURL, relayInfo]])
      }, event.id)
    } finally {
      this.consumers.get(subId)?.onEvent(event)
    }
  }

  async filterEvents(filter: Filter): Promise<Event[]> {
      let collection: Dexie.Collection<EventTrack, string> = this.events.toCollection()

      if (filter.ids && filter.ids.length > 0) {
        const ids = [...filter.ids]
        collection = collection.and(({event}) => ids.includes(event.id))
      }
      
      if (filter.kinds && filter.kinds.length > 0) {
        const kinds = [...filter.kinds]
        collection = collection.and(({event}) => kinds.includes(event.kind))
      }

      if (filter.authors && filter.authors.length > 0) {
        const authors = [...filter.authors]
        collection = collection.and(({event}) => authors.includes(event.pubkey))
      }
      
      if (filter.since) {
        const since = filter.since
        collection = collection.and(({event}) => event.created_at >= since);
      }

      if (filter.until) {
        const until = filter.until
        collection = collection.and(({event}) => event.created_at <= until);
      }

      let events = await collection.toArray()

      if (filter.limit) {
          events = events.slice(0, filter.limit);
      }

      return events.map(e => e.event);
  }
}

const Feed:React.FC<{ 
  store: EventDatabase
  connections: Map<string, Connection>
  sub: Subscription
  relays: string[]
}> = ({ store, connections, sub, relays })  => {
  const [events, setEvents] = useState<Event[]>([])
  const [activeConnections, setActiveConnections] = useState<Map<string, Connection>>(new Map())

  useEffect(() => {
    relays.forEach(r => {
      if(connections.has(r) && !activeConnections.has(r)) {
        setRelay(r)
      }
    })
  },[relays, connections])

  const setRelay = async (relay:string) => {
    const conn = connections.get(relay)
    if(conn) {
      await conn?.sub(
        [{...sub}],
        async (id:string, e:Event) => {
          await store.addEvent(id, e, relay)
        },
        () => console.log(`[EOSE] reached end of sub`),
      )
      store.sub({...sub}, { onEvent: (e) => {
        events.push(e)
        setEvents([...events])
      }})
      activeConnections.set(relay, conn)
      setActiveConnections(new Map(Array.from(activeConnections)))
    }
  }

  const sortedEvents = useMemo(() => {
    return events.sort((a, b) => b.created_at - a.created_at)
  }, [events])

  return (
    <div>
      {sortedEvents.map(event => <Note key={event.id} event={event} />)}
    </div>
  )
}

const FeedSubscription: React.FC<{ sub?: Subscription, onChange: (sub: Subscription) => void}> = ({ sub, onChange }) => {
  const [kinds, setKinds] = useState<Kind[]>(sub?.kinds || [])

  const updateKinds = (kind: Kind) => {
    const updateKinds = [...kinds]
    const index = kinds.indexOf(kind)
    if (index > -1) {
      updateKinds.splice(index, 1)
    } else {
      updateKinds.push(kind)
    }
    setKinds([
      ...updateKinds
    ])
  }

  useEffect(() =>{
    onChange({
      ...sub,
      kinds: kinds,
    })
  }, [kinds])

  const kindForm = Object.values(Kind)
    .filter(k => typeof k !== "string")
    .map((kind) =>{ 
      return {
        label: Kind[kind as Kind],
        kind: kind as Kind,
      }
    })

  return (
    <form>
      {kindForm.map(({kind, label}) => (
        <label key={label}>
          <input
            type="checkbox"
            value={kind}
            checked={kinds.includes(kind)}
            onChange={() => updateKinds(kind)}
          />
          {kind.toString()}:{label}
        </label>
      ))}
    </form>
  ) 
}

export {Connection, Feed, DEFAULT_RELAY as DefaultRelay, EventDatabase}