import {
  createContext,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Client, Session, Socket } from '@heroiclabs/nakama-js'
import { createNakamaClient, NakamaConfig } from 'config/nakama'

interface NakamaContextValue {
  client:     Client
  session:    Session | null
  socket:     Socket | null
  setSession: (s: Session) => void
  setSocket:  (s: Socket) => void
}

const NakamaContext = createContext<NakamaContextValue | null>(null)

export function NakamaProvider({ children }: { children: ReactNode }) {
  const [client]  = useState<Client>(() => createNakamaClient())
  const [session, setSessionState] = useState<Session | null>(null)
  const [socket,  setSocket]       = useState<Socket | null>(null)

  // Restore persisted session on mount and reconnect socket
  useEffect(() => {
    const raw = sessionStorage.getItem('nakama_session')
    if (!raw) return
    const restored = Session.restore(raw, '')
    if (restored.isexpired(Date.now() / 1000)) {
      sessionStorage.removeItem('nakama_session')
      return
    }
    setSessionState(restored)
    const sock = client.createSocket(NakamaConfig.useSSL, false)
    sock.connect(restored, true)
      .then(() => setSocket(sock))
      .catch(() => {
        sessionStorage.removeItem('nakama_session')
        setSessionState(null)
      })
  }, [])

  // Disconnect socket cleanly on tab close
  useEffect(() => {
    const handler = () => socket?.disconnect(false)
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [socket])

  function setSession(s: Session) {
    sessionStorage.setItem('nakama_session', s.token)
    setSessionState(s)
  }

  const value = useMemo(
    () => ({ client, session, socket, setSession, setSocket }),
    [client, session, socket],
  )

  return (
    <NakamaContext.Provider value={value}>
      {children}
    </NakamaContext.Provider>
  )
}

export { NakamaContext }
