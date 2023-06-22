import { FormEvent, MouseEvent, useContext, useMemo, useState } from "react"
import { UserDispatch } from "../../context/user/user"
import { generatePrivateKey, getPublicKey, nip19 } from "nostr-tools"

export const Initialize:React.FC<{}> = ({}) => {
  const [pubKey, setPubKey] = useState<string>("")

  const [passphrase, setPassphrase] = useState("")
  const [newKey, setNew] = useState(false)
  const [nsec, setNsec] = useState("")

  const { createUser, loadUser } = useContext(UserDispatch)

  const generateNsec = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    const sk = generatePrivateKey()
    setNsec(nip19.nsecEncode(sk))
    setPubKey(getPublicKey(sk))
  }

  const copy = async (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    if(nsec) {
      await navigator.clipboard.writeText(nsec)
    }
  }

  const saveNsec = async (e: FormEvent) => {
    e.preventDefault()
    if(nsec && pubKey && passphrase){
      await createUser(nsec, passphrase)
      setPassphrase("")
      setNsec("")
    }
  }

  const unlockFormSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if(pubKey && passphrase) {
      await loadUser(pubKey, passphrase)
      setPassphrase("")
    }
  }

  const createRequired = useMemo(() => {
    return nsec && pubKey && passphrase 
  }, [nsec, pubKey, passphrase])


  return (
    <div className="initialize">
      <div>
        <label>
          import: <input type="checkbox" checked={!newKey} onChange={() => setNew(!newKey)} />
        </label>
        {!newKey && (
            <form onSubmit={unlockFormSubmit}>
              <label>
                pubkey: <input type="text" value={pubKey} onChange={(e) => setPubKey(e.target.value)} /> 
              </label>
              <label>
                passphrase: <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} /> 
              </label>
              <button type="submit">unlock</button>
            </form>
        ) || (
            <form onSubmit={saveNsec}>
            <label>
              nsec: <input type="text" value={nsec} onChange={(e) => setNsec(e.target.value)} required={true} />
            </label>
            {nsec && (<label>
              npub: <input type="text" disabled={true} value={pubKey} required={true} />
            </label>)}
            {nsec && (<label>
              passphrase: <input type="password" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} required={true} />
            </label>)}
            <button onClick={generateNsec}>generate</button>
            {nsec && <button onClick={copy}>copy</button>}
            {nsec && <button type="submit" disabled={!createRequired}>save</button>}
            </form>
        )} 
      </div>
    </div>
  )
}