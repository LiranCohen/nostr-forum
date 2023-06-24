import { Event, verifySignature, Kind, Filter } from 'nostr-tools'
import React, { useEffect, useMemo, useState } from 'react'
import { Note } from '../note/note'
import { Connection } from '../connection/connection'

interface Subscription extends Filter {}
const DEFAULT_RELAY = "wss://grove-relay.onrender.com"
const EVENT_DB = 'NOSTRDB'
const STORE_NAME = 'EventsStore'

class EventStore {
  private db: IDBDatabase | undefined;

  constructor(){}

  async init(): Promise<void> {
    const request = indexedDB.open(EVENT_DB)
    request.onupgradeneeded = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result
      const store = this.db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      store.createIndex('kind', 'kind', { unique: false })
      store.createIndex('pubkey', 'pubkey', { unique: false })
      store.createIndex('create_at', 'create_at', { unique: false })
      store.createIndex('tags', 'tags', { unique: false, multiEntry: true })
    }

    return new Promise<void>((resolve,reject) => {
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result
        resolve()
      }

      request.onerror = () => {
        reject(`error opening database`)
      }
    })
  }

  addEvent(event: Event) {
    const tx = this.db?.transaction([STORE_NAME], 'readwrite')
    const store = tx?.objectStore(STORE_NAME)
    store?.add(event)
  }

  query(filter: Filter[]) {
  }

  getEvent(id: string): Promise<Event|undefined> {
    return new Promise((resolve,reject) => {
      const tx = this.db?.transaction([STORE_NAME], 'readonly')
      const store = tx?.objectStore(STORE_NAME)
      const request = store?.get(id)
      request?.addEventListener('success', () => {
        resolve(request.result)
      })
      request?.addEventListener('error', () => {
        reject(`error getting event ${id}`)
      })
    })
  }

}

const Feed:React.FC<{ connections: Map<string, Connection> }> = ({ connections })  => {

  const [modifySub, setModify] = useState(false)
  const [events, setEvents] = useState<Event[]>([])
  const [sub, setSub] = useState<Subscription>()
  const [relay, setRelay] = useState<string>('')
  const [activeConnection, setActiveConnection] = useState<Connection>()

  useEffect(() => {
   if(activeConnection && sub)  {
    //TODO: This is naive, will have a centralized cache to feed into/from and only reset the component state vs central storage
    setEvents([])
    const s = activeConnection.sub([{...sub}], (e) => {
      processEvent(e)
    }, () => { console.log('eose: end of subscribed events')})

    return () => {
      s?.unsub()
    }
   } else {
    setEvents([])
   }
  }, [sub])

  const currentEvents = useMemo(() => {
    return [...events]
  },[events])

  const processEvent = (e: Event) =>  {
    if (verifySignature(e)) {
      setEvents([e, ...currentEvents])
    }
  }

  useEffect(() => {
    if(relay.length > 0) {
      const conn = connections.get(relay)
      setActiveConnection(conn)
    } else {
      setActiveConnection(undefined)
    }
  }, [relay])

  useEffect(() => {
    setSub({ kinds: [1], limit: 100 })
  },[activeConnection])

  const connectionKeys = useMemo(() => {
    return Array.from(connections.keys())
  }, [connections])

  return (
    <div>
      <div>
        <select value={relay} onChange={(e) => setRelay(e.target.value)}>
          <option value="">None</option>
          {connectionKeys.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <label>Modify Sub: <input type="checkbox" checked={modifySub} onChange={() => setModify(!modifySub)}/></label>
        {modifySub && <FeedSubscription sub={sub} onChange={setSub} />}
      </div>
      <div>{events.map(event => <Note key={event.id} event={event} />)}</div>
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

export {Connection, Feed, DEFAULT_RELAY as DefaultRelay}