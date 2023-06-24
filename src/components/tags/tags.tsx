import React, { useMemo} from 'react'

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

export { TagItem, TagInput }