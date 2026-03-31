import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNakama } from 'hooks/useNakama'
import { useGameStore } from 'store/gameStore'
import { NakamaConfig } from 'config/nakama'
import AppShell from 'components/layout/AppShell'

function getOrCreateDeviceId(): string {
  const key = 'nakama_device_id'
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  localStorage.setItem(key, id)
  return id
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { client, session, setSession, setSocket } = useNakama()
  const [username, setUsername] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Redirect if already authenticated
  useEffect(() => {
    if (session) navigate('/lobby', { replace: true })
  }, [session, navigate])

  async function handleContinue() {
    if (!username.trim()) return
    setLoading(true)
    setError(null)

    try {
      const deviceId = getOrCreateDeviceId()
      const sess = await client.authenticateDevice(deviceId, true, username.trim())
      setSession(sess)

      const sock = client.createSocket(NakamaConfig.useSSL, false)
      await sock.connect(sess, true)
      setSocket(sock)

      useGameStore.getState().setMyUserId(sess.user_id!)
      navigate('/lobby')
    } catch {
      setError('Failed to connect. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppShell>
      <div className="login-page">
        <h1>Tic-Tac-Toe</h1>
        <div className="login-form">
          <input
            type="text"
            placeholder="Enter your nickname"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleContinue()}
            maxLength={32}
            disabled={loading}
          />
          <button
            onClick={handleContinue}
            disabled={loading || !username.trim()}
          >
            {loading ? 'Connecting...' : 'Continue'}
          </button>
          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    </AppShell>
  )
}
