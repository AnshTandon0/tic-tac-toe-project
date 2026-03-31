import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMatchmaker } from 'hooks/useMatchmaker'
import AppShell from 'components/layout/AppShell'
import MatchmakingModal from 'components/lobby/MatchmakingModal'
import RoomCodeModal from 'components/lobby/RoomCodeModal'

export default function LobbyPage() {
  const navigate = useNavigate()
  const { startMatchmaking, cancelMatchmaking, mmStatus, mmError } = useMatchmaker(navigate)

  const [showMatchmakingModal, setShowMatchmakingModal] = useState(false)
  const [showRoomModal, setShowRoomModal]               = useState(false)

  async function handleQuickPlay() {
    setShowMatchmakingModal(true)
    await startMatchmaking()
  }

  async function handleCancelMatchmaking() {
    await cancelMatchmaking()
    setShowMatchmakingModal(false)
  }

  return (
    <AppShell>
      <div className="lobby-page">
        <h2>Choose a mode</h2>

        {mmError && <p className="error-text">{mmError}</p>}

        <div className="lobby-buttons">
          <button
            className="btn-primary"
            onClick={handleQuickPlay}
            disabled={mmStatus === 'searching' || mmStatus === 'joining'}
          >
            Quick Play
          </button>
          <button
            className="btn-secondary"
            onClick={() => setShowRoomModal(true)}
            disabled={mmStatus === 'searching' || mmStatus === 'joining'}
          >
            Private Room
          </button>
        </div>
      </div>

      {showMatchmakingModal && (
        <MatchmakingModal onCancel={handleCancelMatchmaking} />
      )}

      {showRoomModal && (
        <RoomCodeModal onClose={() => setShowRoomModal(false)} />
      )}
    </AppShell>
  )
}
