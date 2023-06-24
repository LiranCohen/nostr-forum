import React, { useState, useMemo } from 'react'
import { TagInput, TagItem } from '../tags/tags'
import { Event, nip19 } from 'nostr-tools'

const shortenKey = (pubKey:string): string => {
  const npub = nip19.npubEncode(pubKey)
  if(npub.length <= 20) return npub
  return `${npub.slice(0, 12)}...${npub.slice(-8)}`
}


const Note:React.FC<{ event: Event}> = ({event}) => {

  const copy = async () => {
    const eventJSON = JSON.stringify(event, undefined, '  ')
    await navigator.clipboard.writeText(eventJSON)  
  }

  return (
  <div>
    <span title={event.pubkey}>from: {shortenKey(event.pubkey)}</span>
    <span>-</span>
    <span>content: {event.content}</span>
    <span><button onClick={() => copy()}>copy raw event</button></span></div>
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

export { NewNote, Note }