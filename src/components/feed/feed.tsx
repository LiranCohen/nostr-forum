import { Relay, relayInit, Event, verifySignature, nip42, Kind, EventTemplate, nip19, Filter } from 'nostr-tools'
import React, { ReactNode, useContext, useEffect, useMemo, useState } from 'react'
import { UserContext } from '../../context/user/user'


interface Subscription extends Filter {}

const DEFAULT_RELAY = "wss://grove-relay.onrender.com"

const Feed:React.FC<{ url: string, onChange: (url: string) => void }> = ({ url, onChange })  => {

  const [modifySub, setModify] = useState(false)
  const [relay, setRelay] = useState<Relay>()
  const [events, setEvents] = useState<Map<string, Event>>(new Map())
  const [editUrl, setUrl] = useState(url)
  const [sub, setSub] = useState<Subscription>()

  const user = useContext(UserContext)

  useEffect(() =>{
    setRelay(relayInit(url))
  }, [url])

  useEffect(() => {
    try {
      new URL(editUrl)
      onChange(editUrl)
    } catch(error) {
      console.log('bad url', editUrl)
    }
  }, [editUrl])

  useEffect(() => {
   if(relay && sub)  {
    //TODO: This is naive, will have a centralized cache to feed into/from and only reset the component state vs central storage
    setEvents(new Map())
    const s = relay.sub([{...sub}])
    s?.on('event', processEvent)
    s?.on('eose', () => { console.log('eose: end of subscribed events') })

    return () => {
      s?.unsub()
    }
   }
  }, [sub])

  useEffect(() => {
    if(relay && user){
      connect()
    }

    return () => {
      relay?.close()
    }
  },[relay, user])

  const processEvent = (e: Event) => {
    if (verifySignature(e)) {
      setEvents(new Map(events.set(e.pubkey, e)))
    }
  }

  const subscribe = () => {
    if(relay) {
      setSub({
        kinds: [1],
        limit: 100,
      })
    }
  }

  const authorize = async (challenge: string) => {

    // TODO: Maybe use this signature for user.signEvent?
    const sign = async <K extends number = number>(e: EventTemplate<K>): Promise<Event<K>> => {
      if(user) {
        const signedEvent = await user.signEvent(e)
        return {
          ...signedEvent,
          kind: e.kind,
        }
      }
      //TODO: this is bad
      throw new Error('invalid')
    }

    if(relay) await nip42.authenticate({ challenge, relay, sign })
  }

  const connect = async () => {
    if(!user) throw Error('could not connect, no user')
    if(!relay) throw Error('could not connect, no relay')
    await relay.connect()

    relay.on('connect', subscribe)
    relay.on('auth', authorize)
  }

  const shortenKey = (pubKey:string): string => {
    const npub = nip19.npubEncode(pubKey)
    if(npub.length <= 20) return npub
    return `${npub.slice(0, 12)}...${npub.slice(-8)}`
  }

  const copyEvent = async (e: Event) => {
    const eventJSON = JSON.stringify(e, undefined, '  ')
    await navigator.clipboard.writeText(eventJSON)  
  }

  const eventList = useMemo(() => {
    const eventListNodes: ReactNode[] = []
    events.forEach(e => {
      eventListNodes.push(<div key={e.id} style={{border: '1px solid #ccc'}}>
        <span title={e.pubkey}>from: {shortenKey(e.pubkey)}</span>
        <span>-</span>
        <span>content: {e.content}</span>
        <span><button onClick={() => copyEvent(e)}>copy raw event</button></span>
      </div>)
    })  
    return eventListNodes
  }, [events])

  return (
    <div>
      <div>
        <label>Modify Sub: <input type="checkbox" checked={modifySub} onChange={() => setModify(!modifySub)}/></label>
        {modifySub && <ModifySubscription url={editUrl} setUrl={setUrl} sub={sub} onChange={setSub} />}
      </div>
      <div>{eventList}</div>
    </div>
  )
}

const ModifySubscription:React.FC<{
  url: string
  setUrl: (url: string) => void
  sub?: Subscription
  onChange: (sub: Subscription) => void
}> = ({ url, setUrl, sub, onChange }) => {

  return(
    <div>
      <label>relay url: <input type="text" value={url} onChange={(e) => setUrl(e.target.value)} /></label>
      <FeedSubscription sub={sub} onChange={onChange} />
    </div>
  )
}

const TagItem:React.FC<{tag: string[], delItem: () => void}> = ({ tag, delItem }) => {
  const del = (e: React.MouseEvent) => {
    e.preventDefault()
    delItem()
  }

  return (
    <div>{tag.join(", ")} <button onClick={del}>del</button></div>
  )
}

const TagInput:React.FC<{ tag: string[], onChange: (tag: string[]) => void}> = ({tag, onChange}) => {
  const tags = useMemo(() => {
    if(tag.length > 1 && tag[tag.length - 1]?.length === 0) {
      return [...tag]
    }
    return [ ...tag, ""]
  }, [tag])

  const updateTag = (value: string, index: number) => {
    const updated = [...tags]
    if(updated.length === 1) {
      onChange([value])
    } else if(value.length === 0) {
      updated.splice(index, 1)
      onChange([...updated])
    } else {
      onChange([...updated.slice(0, index), value, ...updated.slice(index + 1)])
    }
  }

  return (
    <span>{tags.map((t, i) => <input type="text" value={t} onChange={(e) => updateTag(e.target.value, i)} placeholder="..." />)}</span>
  )
}

const NewNote:React.FC = () => {
  const [content, setContent] = useState("")
  const [tags, setTags] = useState<string[][]>([])
  const [newTag, setNewTag] = useState<string[]>([])

  const delItem = (index: number) => {
    tags.splice(index, 1) 
    setTags([...tags])
  }

  const validateNewTag = useMemo(() => {
    return newTag.length > 2 
  }, [newTag])

  const addItem = () => {
    setTags([
      ...tags,
      newTag,
    ])
    setNewTag([])
  }

  return (
    <div>
      <div><label>kind: <input type="number" value={1} disabled={true}></input></label></div>
      <div><label>content: <input type="text" value={content} onChange={(e) => setContent(e.target.value)} /></label></div>
      <div>
        <div><label>tags: {tags.map((t, i) => <TagItem key={t.join(",")} tag={t} delItem={() => delItem(i)} />)}</label></div>
        <div><label>add tag: <TagInput tag={newTag} onChange={setNewTag} /></label><button disabled={!validateNewTag} onClick={() => addItem()}>add</button><button onClick={() => { setNewTag([])}}>clear</button></div>
      </div>
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

export {Feed, DEFAULT_RELAY as DefaultRelay}