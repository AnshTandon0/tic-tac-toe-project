import { CellValue } from 'types/game'

interface Props {
  index:    number
  value:    CellValue
  isWinCell: boolean
  onClick?: () => void
}

export default function Cell({ index, value, isWinCell, onClick }: Props) {
  return (
    <button
      className={`cell${value ? ' cell--filled' : ''}${isWinCell ? ' cell--win' : ''}`}
      onClick={onClick}
      disabled={!onClick || value !== ''}
      aria-label={`Cell ${index}, ${value || 'empty'}`}
    >
      {value && (
        <span className={`symbol symbol--${value.toLowerCase()}`}>
          {value}
        </span>
      )}
    </button>
  )
}
