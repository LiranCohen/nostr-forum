import { useContext, useEffect, useMemo, useState } from 'react'
import './App.css'
import { Initialize } from './components/initialize/initialize'
import { UserContext } from './context/user/user'
import { Connection, DefaultRelay, Feed } from './components/feed/feed'
import { ConnectionManager } from './components/connection/connection'

function App() {
  const [connections, setConnections] = useState<Map<string, Connection>>(new Map())
  const user = useContext(UserContext)

  const connectDefault = async () => {
    if(user) {
      const conn  = await Connection.connect(DefaultRelay, { signEvent: (event) => user.signEvent(event) }, { notice: (msg) => console.log(`[NOTICE] ${DefaultRelay} - ${msg}`)})
      setConnections(new Map(connections.set(DefaultRelay, conn)))
    }
  }

  useEffect(() => {
    if(user && user.npub() && connections.size === 0) {
      connectDefault()
    }
  },[user, connections])
  
  const npub = useMemo(() => {
    return user?.npub()
  }, [user])

  return (
   <div>
    {(user && npub && npub.length > 0) && <div>
      <ConnectionManager connections={connections} setConnections={setConnections} user={user} />
      <Feed connections={connections} /> 
    </div>|| <Initialize />}
   </div> 
  )
}

export default App
