import React, { useMemo, useState } from 'react'
import { Event, EventTemplate, Filter, Kind, Relay, Sub, nip42, relayInit } from "nostr-tools"
import { User } from '../../context/user/user'
import canonicalize from 'canonicalize'

const ConnectionManager: React.FC<{
  user: User,
  connections: Map<string, Connection>,
  setConnections: (connections: Map<string, Connection>) => void
}> = ({ user, connections, setConnections }) => {

  const [newConnect, setNew] = useState("")

  const connect = async (url: string) => {
    const conn = await Connection.connect(url, { signEvent: (event) => user.signEvent(event)}, {notice: (msg: string) => { console.log(`[NOTICE] ${url} - ${msg}`)}})
    connections.set(url, conn)
    setConnections(new Map(connections))
  }

  const disconnect = async (url: string) => {
    const conn = connections.get(url)
    if(conn) {
      conn.close()
      connections.delete(url)
    }
  }

  const add = async () => {
    if(canAdd) {
      await connect(newConnect) 
      setNew("")
    }
  }

  const canAdd = useMemo(() => {
    const exists = connections.get(newConnect)
    if(!exists) {
      try {
        new URL(newConnect)
        return true
      } catch(error) {}
    }
    return false
  }, [newConnect, connections])

  const connectionKeys = useMemo(() => {
    return Array.from(connections.keys())
  },[connections])

  return (
    <div>
      {connectionKeys.map(url => <div key={url}>{url}<button onClick={() => disconnect(url)}>disconnect</button></div>)}
      <div>
        <input value={newConnect} onChange={(e) => setNew(e.target.value)} placeholder="wss://relay.damus.io" />
        <button disabled={!canAdd} onClick={add}>connect</button>
      </div>
    </div>
  )
}

interface Signer {
  signEvent: <K extends number = number>(event: EventTemplate<K>) => Promise<Event<K>> 
}

interface Noticer {
  notice: (msg: string) => void
}

class Connection {
  private relay: Relay
  private signer: Signer
  private connected: boolean
  private errorCount: number

  private subscriptions: Map<string, Sub<Kind>>

  private constructor(relay: Relay, signer: Signer, noticer: Noticer) {
    this.signer = signer
    this.connected = false
    this.errorCount = 0

    relay.on('auth', (challenge) => this.authorize(challenge))
    relay.on('connect', () => this.onConnect())
    relay.on('disconnect',() => this.onDisconnect())
    relay.on('error', () => this.onError())
    relay.on('notice', (msg) => noticer.notice(msg))
    this.relay = relay
    this.subscriptions = new Map()
  }

  static async connect(url: string, signer: Signer, noticer: Noticer): Promise<Connection> {
    const relay = relayInit(url)
    const conn = new Connection(relay, signer, noticer)
    await conn.connect()
    return conn
  }

  private onConnect() {
    this.connected = true
  }

  private onDisconnect() {
    this.connected = false
  }

  private onError() {
    this.errorCount = this.errorCount + 1
  }
  
  private async authorize(challenge: string) {
    await nip42.authenticate({ challenge, relay: this.relay, sign: this.signer.signEvent })
  }

  private async connect() {
    await this.relay.connect()
  }

  get isConnected () {
    return this.connected
  }

  get relayURL () {
    return this.relay.url
  }

  close() {
    return this.relay.close()
  }

  async sub(sub: Filter[], processEvent: (id:string, e: Event) => void, eose: () => void) {

    const subHash = await hashSub(sub)
    const s = this.subscriptions.get(subHash)
    if(s) {
      s.on('event', (e) => processEvent(subHash, e))
      s.on('eose', eose)
    } else {
      const s = this.relay.sub(sub)
      s.on('event', (e) => processEvent(subHash, e))
      s.on('eose', eose)
    }

    return s
  }

}

const hashSub = async (sub: Filter[]): Promise<string> => {

  const hashFitler = async (filter: Filter): Promise<string> => {
    const encodedFilter = new TextEncoder().encode(canonicalize(filter))
    const d = new Uint8Array(await window.crypto.subtle.digest('SHA-256', encodedFilter))
    return btoa(Array.from(d).map(byte => String.fromCharCode(byte)).join(''))
  }

  const longKey = new TextEncoder().encode(sub.map(hashFitler).sort().join(""))
  const keyHash = new Uint8Array(await window.crypto.subtle.digest('SHA-256', longKey))
  return btoa(Array.from(keyHash).map(byte => String.fromCharCode(byte)).join(''))
}

export { Connection, ConnectionManager, hashSub }