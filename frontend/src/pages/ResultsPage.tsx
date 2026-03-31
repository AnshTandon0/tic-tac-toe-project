import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from 'store/gameStore'
import AppShell from 'components/layout/AppShell'
import Board from 'components/game/Board'

export default function ResultsPage() {
  const navigate = useNavigate()
  const { winner, winLine, board, players, myUserId, resetGame } = useGameStore()

  // Prevent direct URL access before game ends
  useEffect(() => {
    if (winner === null) navigate('/lobby', { replace: true })
  }, [winner, navigate])

  const resultText = (() => {
    if (winner === 'server_shutdown') return 'Game ended by server'
    if (winner === '')               return "It's a draw!"
    if (winner === myUserId)         return 'You won!'
    return `${players[winner ?? '']?.username ?? 'Opponent'} won`
  })()

  function handlePlayAgain() {
    resetGame()
    navigate('/lobby')
  }

  return (
    <AppShell>
      <div className="results-page">
        <h1 className="result-text">{resultText}</h1>
        <Board
          board={board}
          winLine={winLine}
          onCellClick={() => {}}
          disabled={true}
        />
        <button className="btn-primary" onClick={handlePlayAgain}>
          Play Again
        </button>
      </div>
    </AppShell>
  )
}
