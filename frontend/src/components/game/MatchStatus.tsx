import { PlayerInfo } from 'types/game'

interface Props {
  phase:       'waiting' | 'playing' | 'over'
  currentTurn: string
  players:     Record<string, PlayerInfo>
}

export default function MatchStatus({ phase, currentTurn, players }: Props) {
  const statusText = (() => {
    if (phase === 'waiting') return 'Waiting for opponent...'
    if (phase === 'over')    return 'Game over'
    const name = players[currentTurn]?.username ?? '...'
    return `${name}'s turn`
  })()

  return (
    <div className="match-status">
      <span>{statusText}</span>
    </div>
  )
}
