import { create } from 'zustand'
import {
  GameStateMessage,
  BoardUpdateMessage,
  GameOverMessage,
  PlayerJoinedMessage,
  PlayerLeftMessage,
  MatchPhase,
  Symbol as ProtoSymbol,
} from 'gen/game_pb'
import { CellValue, MatchmakingStatus, PlayerInfo } from 'types/game'

function protoPhaseToString(phase: MatchPhase): 'waiting' | 'playing' | 'over' {
  switch (phase) {
    case MatchPhase.MATCH_PHASE_PLAYING: return 'playing'
    case MatchPhase.MATCH_PHASE_OVER:    return 'over'
    default:                             return 'waiting'
  }
}

interface GameStore {
  // ── Game state ──────────────────────────────────────────────────────────────
  matchId:     string
  board:       CellValue[]
  playerX:     string
  playerO:     string
  players:     Record<string, PlayerInfo>
  currentTurn: string
  phase:       'waiting' | 'playing' | 'over'
  winner:      string | null
  winLine:     number[] | null
  myUserId:    string

  // ── Matchmaking state ───────────────────────────────────────────────────────
  mmStatus: MatchmakingStatus
  mmTicket: string | null
  mmError:  string | null

  // ── Actions ─────────────────────────────────────────────────────────────────
  setMyUserId: (userId: string) => void
  setMatchId:  (id: string) => void

  applyGameState:    (msg: GameStateMessage,    myUserId: string) => void
  applyBoardUpdate:  (msg: BoardUpdateMessage)                    => void
  applyGameOver:     (msg: GameOverMessage)                       => void
  applyPlayerJoined: (msg: PlayerJoinedMessage)                   => void
  applyPlayerLeft:   (msg: PlayerLeftMessage)                     => void

  setMmStatus: (s: MatchmakingStatus) => void
  setMmTicket: (t: string | null)     => void
  setMmError:  (e: string | null)     => void

  resetGame: () => void
}

const initialGameState = {
  matchId:     '',
  board:       Array(9).fill('') as CellValue[],
  playerX:     '',
  playerO:     '',
  players:     {} as Record<string, PlayerInfo>,
  currentTurn: '',
  phase:       'waiting' as const,
  winner:      null,
  winLine:     null,
  myUserId:    '',
}

const initialMmState = {
  mmStatus: 'idle' as const,
  mmTicket: null,
  mmError:  null,
}

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialGameState,
  ...initialMmState,

  setMyUserId: (userId) => set({ myUserId: userId }),
  setMatchId:  (id)     => set({ matchId: id }),

  applyGameState(msg, myUserId) {
    set({
      board:       msg.board as CellValue[],
      playerX:     msg.playerX,
      playerO:     msg.playerO,
      currentTurn: msg.currentTurn,
      phase:       protoPhaseToString(msg.phase),
      myUserId,
    })
  },

  applyBoardUpdate(msg) {
    set({
      board:       msg.board as CellValue[],
      currentTurn: msg.currentTurn,
    })
  },

  applyGameOver(msg) {
    set({
      board:   msg.board as CellValue[],
      phase:   'over',
      winner:  msg.winner,
      winLine: msg.winLine.length > 0 ? [...msg.winLine] : null,
    })
  },

  applyPlayerJoined(msg) {
    set(state => ({
      players: {
        ...state.players,
        [msg.playerId]: {
          userId:   msg.playerId,
          username: msg.username,
          symbol:   msg.symbol === ProtoSymbol.SYMBOL_X ? 'X' : 'O',
        },
      },
    }))
  },

  applyPlayerLeft(msg) {
    set(state => {
      const updated = { ...state.players }
      if (updated[msg.playerId]) {
        updated[msg.playerId] = { ...updated[msg.playerId], disconnected: true }
      }
      return { players: updated }
    })
  },

  setMmStatus: (s) => set({ mmStatus: s }),
  setMmTicket: (t) => set({ mmTicket: t }),
  setMmError:  (e) => set({ mmError: e }),

  resetGame() {
    set({ ...initialGameState, myUserId: get().myUserId })
  },
}))
