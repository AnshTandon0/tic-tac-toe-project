import { CellValue } from 'types/game'
import Cell from 'components/game/Cell'

interface Props {
  board:       CellValue[]
  winLine:     number[] | null
  onCellClick: (index: number) => void
  disabled:    boolean
}

export default function Board({ board, winLine, onCellClick, disabled }: Props) {
  return (
    <div className="board" role="grid" aria-label="Tic-Tac-Toe board">
      {board.map((value, i) => (
        <Cell
          key={i}
          index={i}
          value={value}
          isWinCell={winLine?.includes(i) ?? false}
          onClick={disabled ? undefined : () => onCellClick(i)}
        />
      ))}
    </div>
  )
}
