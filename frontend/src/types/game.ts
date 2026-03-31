export type CellValue = 'X' | 'O' | ''

export interface PlayerInfo {
  userId:        string
  username:      string
  symbol:        'X' | 'O'
  disconnected?: boolean
}

export interface GameState {
  matchId:      string
  board:        CellValue[]
  playerX:      string
  playerO:      string
  players:      Record<string, PlayerInfo>
  currentTurn:  string
  phase:        'waiting' | 'playing' | 'over'
  winner:       string | null
  winLine:      number[] | null
  myUserId:     string
}

export type MatchmakingStatus =
  | 'idle'
  | 'searching'
  | 'joining'
  | 'in_match'

export interface MatchmakingState {
  status:  MatchmakingStatus
  ticket:  string | null
  error:   string | null
}
