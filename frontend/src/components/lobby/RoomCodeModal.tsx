import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatchmaker } from 'hooks/useMatchmaker'

interface Props {
  onClose: () => void
}

type Mode = 'choose' | 'join'

export default function RoomCodeModal({ onClose }: Props) {
  const navigate = useNavigate()
  const { createPrivateRoom, joinPrivateRoom } = useMatchmaker(navigate)

  const [mode, setMode]       = useState<Mode>('choose')
  const [code, setCode]       = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  async function handleCreate() {
    setLoading(true)
    setError(null)
    try {
      await createPrivateRoom()
    } catch {
      setError('Failed to create room. Please try again.')
      setLoading(false)
    }
  }

  async function handleJoin() {
    if (!code.trim()) return
    setLoading(true)
    setError(null)
    try {
      await joinPrivateRoom(code.trim())
    } catch {
      setError('Failed to join room. Check the code and try again.')
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        {mode === 'choose' && (
          <>
            <h3>Private Room</h3>
            <button className="btn-primary" onClick={handleCreate} disabled={loading}>
              {loading ? 'Creating...' : 'Create Room'}
            </button>
            <button className="btn-secondary" onClick={() => setMode('join')} disabled={loading}>
              Join Room
            </button>
          </>
        )}

        {mode === 'join' && (
          <>
            <h3>Enter Room Code</h3>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Room code"
              disabled={loading}
            />
            <button
              className="btn-primary"
              onClick={handleJoin}
              disabled={loading || !code.trim()}
            >
              {loading ? 'Joining...' : 'Join'}
            </button>
            <button onClick={() => setMode('choose')} disabled={loading}>
              Back
            </button>
          </>
        )}

        {error && <p className="error-text">{error}</p>}
      </div>
    </div>
  )
}
