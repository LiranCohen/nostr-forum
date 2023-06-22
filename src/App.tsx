import { useContext, useMemo } from 'react'
import './App.css'
import { Initialize } from './components/initialize/initialize'
import { UserContext } from './context/user/user'

function App() {
  const user = useContext(UserContext)

  const pubKey = useMemo(() => {
    return user?.pubKey()
  }, [user])

  return (
   <>
    {pubKey || <Initialize />}
   </> 
  )
}

export default App
