import { PlayerInfo } from 'types/game'

interface Props {
  player?:       PlayerInfo
  isCurrentTurn: boolean
  isMe:          boolean
}

export default function PlayerCard({ player, isCurrentTurn, isMe }: Props) {
  const turnLabel = isMe ? 'Your turn' : `${player?.username ?? 'Opponent'}'s turn`

  return (
    <div className={`player-card${isCurrentTurn ? ' player-card--active' : ''}`}>
      <span className="player-symbol">{player?.symbol ?? '?'}</span>
      <span className="player-name">{player?.username ?? 'Waiting...'}</span>
      {player?.disconnected && <span className="disconnected-badge">Disconnected</span>}
      {isCurrentTurn && <span className="turn-indicator">{turnLabel}</span>}
    </div>
  )
}
