import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNakama } from 'hooks/useNakama'
import { useGameStore } from 'store/gameStore'
import { MakeMoveRequest } from 'gen/game_pb'
import { OpCode } from 'config/nakama'
import AppShell from 'components/layout/AppShell'
import Board from 'components/game/Board'
import PlayerCard from 'components/game/PlayerCard'
import MatchStatus from 'components/game/MatchStatus'

export default function GamePage() {
  const navigate = useNavigate()
  const { socket } = useNakama()

  const { board, phase, currentTurn, players, winLine, myUserId, matchId, playerX, playerO } =
    useGameStore()

  // Redirect if we somehow land here without a match
  useEffect(() => {
    if (!matchId) navigate('/lobby', { replace: true })
  }, [matchId, navigate])

  const isMyTurn = currentTurn === myUserId

  function handleCellClick(index: number) {
    if (phase !== 'playing') return
    if (!isMyTurn) return
    if (board[index] !== '') return

    const bytes = MakeMoveRequest.toBinary({ cellIndex: index })
    socket!.sendMatchState(matchId, OpCode.MAKE_MOVE, bytes)
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(matchId)
  }

  return (
    <AppShell>
      <div className="game-page">
        {phase === 'waiting' && (
          <div className="waiting-room">
            <p className="hint">Waiting for opponent...</p>
            <p className="hint">Share this code:</p>
            <code className="room-code">{matchId}</code>
            <button className="btn-secondary" onClick={handleCopyCode}>Copy Code</button>
          </div>
        )}

        <MatchStatus phase={phase} currentTurn={currentTurn} players={players} />

        <div className="players-row">
          <PlayerCard
            player={players[playerX]}
            isCurrentTurn={currentTurn === playerX}
            isMe={playerX === myUserId}
          />
          <span className="vs-label">VS</span>
          <PlayerCard
            player={players[playerO]}
            isCurrentTurn={currentTurn === playerO}
            isMe={playerO === myUserId}
          />
        </div>

        <Board
          board={board}
          winLine={winLine}
          onCellClick={handleCellClick}
          disabled={!isMyTurn || phase !== 'playing'}
        />
      </div>
    </AppShell>
  )
}
