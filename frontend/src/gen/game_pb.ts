/**
 * Hand-written proto codec for game.proto.
 * Provides the same encode/decode API as @protobuf-ts/plugin output.
 * Re-run `make proto` once protoc + @protobuf-ts/plugin are available
 * to replace this file with auto-generated code.
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export enum MatchPhase {
  MATCH_PHASE_UNSPECIFIED = 0,
  MATCH_PHASE_WAITING     = 1,
  MATCH_PHASE_PLAYING     = 2,
  MATCH_PHASE_OVER        = 3,
}

export enum Symbol {
  SYMBOL_UNSPECIFIED = 0,
  SYMBOL_X           = 1,
  SYMBOL_O           = 2,
}

// ── Message interfaces ────────────────────────────────────────────────────────

export interface MakeMoveRequest {
  cellIndex: number
}

export interface GameStateMessage {
  board:       string[]
  playerX:     string
  playerO:     string
  currentTurn: string
  phase:       MatchPhase
}

export interface BoardUpdateMessage {
  board:       string[]
  currentTurn: string
  moveIndex:   number
  movedBy:     string
}

export interface GameOverMessage {
  board:    string[]
  winner:   string
  winLine:  number[]
  playerX:  string
  playerO:  string
}

export interface PlayerJoinedMessage {
  playerId: string
  symbol:   Symbol
  username: string
}

export interface PlayerLeftMessage {
  playerId: string
}

export interface CreateMatchRequest  {}
export interface CreateMatchResponse { matchId: string }

// ── Wire encoding ─────────────────────────────────────────────────────────────

function encodeVarint(n: number): number[] {
  const out: number[] = []
  while (n > 0x7f) {
    out.push((n & 0x7f) | 0x80)
    n >>>= 7
  }
  out.push(n & 0x7f)
  return out
}

function encodeTag(field: number, wtype: number): number[] {
  return encodeVarint((field << 3) | wtype)
}

function encodeStringField(field: number, s: string): number[] {
  const enc = new TextEncoder().encode(s)
  return [...encodeTag(field, 2), ...encodeVarint(enc.length), ...enc]
}

function encodeVarintField(field: number, n: number): number[] {
  return [...encodeTag(field, 0), ...encodeVarint(n)]
}

// ── Wire decoding ─────────────────────────────────────────────────────────────

class Reader {
  pos = 0
  constructor(private buf: Uint8Array) {}

  get done(): boolean { return this.pos >= this.buf.length }

  readVarint(): number {
    let result = 0, shift = 0
    for (;;) {
      const b = this.buf[this.pos++]
      result |= (b & 0x7f) << shift
      if (!(b & 0x80)) break
      shift += 7
    }
    return result
  }

  readString(): string {
    const len = this.readVarint()
    const slice = this.buf.slice(this.pos, this.pos + len)
    this.pos += len
    return new TextDecoder().decode(slice)
  }

  skipField(wtype: number): void {
    switch (wtype) {
      case 0: this.readVarint(); break
      case 2: {
        const len = this.readVarint()
        this.pos += len
        break
      }
      case 1: this.pos += 8; break
      case 5: this.pos += 4; break
    }
  }
}

// ── Message codecs ────────────────────────────────────────────────────────────

export const MakeMoveRequest = {
  toBinary(msg: MakeMoveRequest): Uint8Array {
    const bytes = encodeVarintField(1, msg.cellIndex)
    return new Uint8Array(bytes)
  },
  fromBinary(buf: Uint8Array): MakeMoveRequest {
    const r = new Reader(buf)
    const m: MakeMoveRequest = { cellIndex: 0 }
    while (!r.done) {
      const tag = r.readVarint()
      const field = tag >>> 3, wtype = tag & 0x7
      if (field === 1 && wtype === 0) m.cellIndex = r.readVarint()
      else r.skipField(wtype)
    }
    return m
  },
}

export const GameStateMessage = {
  fromBinary(buf: Uint8Array): GameStateMessage {
    const r = new Reader(buf)
    const m: GameStateMessage = { board: [], playerX: '', playerO: '', currentTurn: '', phase: MatchPhase.MATCH_PHASE_UNSPECIFIED }
    while (!r.done) {
      const tag = r.readVarint()
      const field = tag >>> 3, wtype = tag & 0x7
      switch (field) {
        case 1: if (wtype === 2) m.board.push(r.readString()); else r.skipField(wtype); break
        case 2: if (wtype === 2) m.playerX = r.readString(); else r.skipField(wtype); break
        case 3: if (wtype === 2) m.playerO = r.readString(); else r.skipField(wtype); break
        case 4: if (wtype === 2) m.currentTurn = r.readString(); else r.skipField(wtype); break
        case 5: if (wtype === 0) m.phase = r.readVarint(); else r.skipField(wtype); break
        default: r.skipField(wtype)
      }
    }
    return m
  },
}

export const BoardUpdateMessage = {
  fromBinary(buf: Uint8Array): BoardUpdateMessage {
    const r = new Reader(buf)
    const m: BoardUpdateMessage = { board: [], currentTurn: '', moveIndex: 0, movedBy: '' }
    while (!r.done) {
      const tag = r.readVarint()
      const field = tag >>> 3, wtype = tag & 0x7
      switch (field) {
        case 1: if (wtype === 2) m.board.push(r.readString()); else r.skipField(wtype); break
        case 2: if (wtype === 2) m.currentTurn = r.readString(); else r.skipField(wtype); break
        case 3: if (wtype === 0) m.moveIndex = r.readVarint(); else r.skipField(wtype); break
        case 4: if (wtype === 2) m.movedBy = r.readString(); else r.skipField(wtype); break
        default: r.skipField(wtype)
      }
    }
    return m
  },
}

export const GameOverMessage = {
  fromBinary(buf: Uint8Array): GameOverMessage {
    const r = new Reader(buf)
    const m: GameOverMessage = { board: [], winner: '', winLine: [], playerX: '', playerO: '' }
    while (!r.done) {
      const tag = r.readVarint()
      const field = tag >>> 3, wtype = tag & 0x7
      switch (field) {
        case 1: if (wtype === 2) m.board.push(r.readString()); else r.skipField(wtype); break
        case 2: if (wtype === 2) m.winner = r.readString(); else r.skipField(wtype); break
        case 3:
          if (wtype === 0) {
            // non-packed
            m.winLine.push(r.readVarint())
          } else if (wtype === 2) {
            // packed
            const len = r.readVarint()
            const end = r.pos + len
            while (r.pos < end) m.winLine.push(r.readVarint())
          } else r.skipField(wtype)
          break
        case 4: if (wtype === 2) m.playerX = r.readString(); else r.skipField(wtype); break
        case 5: if (wtype === 2) m.playerO = r.readString(); else r.skipField(wtype); break
        default: r.skipField(wtype)
      }
    }
    return m
  },
}

export const PlayerJoinedMessage = {
  fromBinary(buf: Uint8Array): PlayerJoinedMessage {
    const r = new Reader(buf)
    const m: PlayerJoinedMessage = { playerId: '', symbol: Symbol.SYMBOL_UNSPECIFIED, username: '' }
    while (!r.done) {
      const tag = r.readVarint()
      const field = tag >>> 3, wtype = tag & 0x7
      switch (field) {
        case 1: if (wtype === 2) m.playerId = r.readString(); else r.skipField(wtype); break
        case 2: if (wtype === 0) m.symbol = r.readVarint(); else r.skipField(wtype); break
        case 3: if (wtype === 2) m.username = r.readString(); else r.skipField(wtype); break
        default: r.skipField(wtype)
      }
    }
    return m
  },
}

export const PlayerLeftMessage = {
  fromBinary(buf: Uint8Array): PlayerLeftMessage {
    const r = new Reader(buf)
    const m: PlayerLeftMessage = { playerId: '' }
    while (!r.done) {
      const tag = r.readVarint()
      const field = tag >>> 3, wtype = tag & 0x7
      if (field === 1 && wtype === 2) m.playerId = r.readString()
      else r.skipField(wtype)
    }
    return m
  },
}

export const CreateMatchRequest = {
  toJson(_msg: CreateMatchRequest): Record<string, never> {
    return {}
  },
}

export const CreateMatchResponse = {
  fromJson(obj: Record<string, unknown>): CreateMatchResponse {
    return { matchId: (obj['matchId'] as string) ?? '' }
  },
}
