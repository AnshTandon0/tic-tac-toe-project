interface Props {
  onCancel: () => void
}

export default function MatchmakingModal({ onCancel }: Props) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <p>Finding a random player...</p>
        <p className="hint">It usually takes 20 seconds.</p>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
