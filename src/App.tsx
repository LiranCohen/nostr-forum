import { useContext, useMemo, useState } from 'react'
import './App.css'
import { Initialize } from './components/initialize/initialize'
import { UserContext } from './context/user/user'
import { DefaultRelay, Feed } from './components/feed/feed'

function App() {
  const user = useContext(UserContext)
  const [feedRelay, setFeedRelay] = useState(DefaultRelay)
  const npub = useMemo(() => {
    return user?.npub()
  }, [user])

  return (
   <div>
    {npub && <Feed url={feedRelay} onChange={setFeedRelay} /> || <Initialize />}
   </div> 
  )
}

export default App
