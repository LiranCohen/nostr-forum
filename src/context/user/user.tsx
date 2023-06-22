import { Event, UnsignedEvent, getEventHash, getPublicKey, getSignature, nip19 } from "nostr-tools";
import { ReactNode, createContext, useMemo, useState } from "react";

interface UserInterface {
  loadUser: (pubKey: string, passphrase: string) => Promise<void>
  createUser: (nsec: string, passphrase: string) => Promise<void>
}

const UserContext = createContext<User|undefined>(undefined)
const UserDispatch = createContext<UserInterface>({ loadUser: async () => {}, createUser: async () => {}})

const UserProvider: React.FC<{ children?: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User>()

  const loadUser = async (pubKey: string, passphrase: string) => {
    const u = await User.load(pubKey, passphrase)
    setUser(u)
  }

  const createUser = async (nsec: string, passphrase: string) => {
    const u = await User.init(passphrase, nsec)
    setUser(u)
  }

  return (
    <UserDispatch.Provider value={{ loadUser, createUser }}>
      <UserContext.Provider value={user}>
        {children}
      </UserContext.Provider>
    </UserDispatch.Provider>
  )
}


class User {
  private static encoder = new TextEncoder();
  private static decoder = new TextDecoder();
  private encryptionKey: CryptoKey;
  private _infoKey?: string
  private _nostrPubKey?: string;

  private constructor(encryptionKey: CryptoKey) {
    this.encryptionKey = encryptionKey
  }

  static async init(passphrase: string, nsec: string): Promise<User> {
    const privKey = nip19.decode(nsec)
    if(privKey.type !== "nsec") {
      throw new Error("invalid nsec")
    }

    const pubKey = getPublicKey(privKey.data)
    const encryptionKey = await User.encryptionKey(pubKey, passphrase)
    const u = new User(encryptionKey)
    await u.setKeyInfo(privKey.data)
    return u
  }

  private static async encryptionKey(pubKey: string, passphrase: string) {
    const pbkdf2Params = { name: "PBKDF2", salt: this.encoder.encode(pubKey), iterations: 100000, hash: "SHA-256"}
    const baseKey = await window.crypto.subtle.importKey(
      "raw",
      this.encoder.encode(passphrase),
      { name: "PBKDF2" },
      false,
      ["deriveBits", "deriveKey"]
    )

    return window.crypto.subtle.deriveKey(
      pbkdf2Params,
      baseKey,
      { name: "AES-GCM", length: 256},
      true,
      ["encrypt", "decrypt"]
    )
  }

  static async load(pubKey: string, passphrase: string): Promise<User> {
    const encryptionKey = await User.encryptionKey(pubKey, passphrase)
    const u = new User(encryptionKey)
    await u.getKeyInfo(pubKey)
    return u
  }

  private async setKeyInfo(privateKey: string) {
    const pubKey = getPublicKey(privateKey)

    const infoKey = this.infoKey(pubKey)
    const encryptedInfo = this.encrypt(`${pubKey}.${privateKey}`)
    localStorage.setItem(await infoKey, await encryptedInfo)
    this._nostrPubKey = pubKey
  }

  private async getKeyInfo(pubKey: string) {
    const keyInfo = localStorage.getItem(await this.infoKey(pubKey))
    if(keyInfo) {
      const decryptedInfo = await this.decrypt(keyInfo)
      const [secretPubKey, secret] = decryptedInfo.split(".")
      if(this.validateKeyInfo(secretPubKey, secret)) {
        return { pubKey: secretPubKey, privateKey: secret}
      } 
    }
    throw new Error('could not get key info')
  }

  private async infoKey(pubKey: string): Promise<string> {
    if (!this._infoKey) {
      if(pubKey.length === 0) {
        throw new Error('invalid pubkey')
      }
      const hash = await window.crypto.subtle.digest('SHA-256', User.encoder.encode(pubKey))
      const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join("")
      this._infoKey = `key-info-${hashHex}`
    }
    return this._infoKey
  }

  private async encrypt(data: string): Promise<string> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12))
    const encryptedData = await window.crypto.subtle.encrypt(
      { name:  "AES-GCM", iv },
      this.encryptionKey,
      User.encoder.encode(data)
    )
    return window.btoa(new Uint8Array(Array.from(iv).concat(Array.from(new Uint8Array(encryptedData)))).toString())
  }

  private async decrypt(encryptedData: string): Promise<string> {
    const buffer = Array.from(window.atob(encryptedData).split(",").map(Number))
    const iv = new Uint8Array(buffer.slice(0, 12))
    const data = new Uint8Array(buffer.slice(12))
    const decryptedData = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      this.encryptionKey,
      data,
    );
    return User.decoder.decode(decryptedData);
  }

  private validateKeyInfo(secretPubKey: string, secret: string) {
    if (!secretPubKey || !secret) throw new Error('could not decode key info')
    if(secretPubKey !== getPublicKey(secret)) throw new Error('invalid secret pubkey')
    this._nostrPubKey = secretPubKey
    return true
  }

  private async getSignature(event: UnsignedEvent): Promise<string> {
    if(!this._nostrPubKey) throw new Error('locked')

    const keyInfo = await this.getKeyInfo(this._nostrPubKey)
    if (event.pubkey != keyInfo.pubKey) throw new Error('invalid pubkey')
    return getSignature(event, keyInfo.privateKey)
  }

  async signEvent(event: UnsignedEvent): Promise<Event> {
    const sig = await this.getSignature(event)
    const id = getEventHash(event)
    return {
      ...event,
      id,
      sig,
    }
  }

  pubKey() {
    return this._nostrPubKey
  }

}

export { User, UserContext, UserDispatch, UserProvider }