import { Client } from '@heroiclabs/nakama-js'

export const NakamaConfig = {
  host:      import.meta.env.VITE_NAKAMA_HOST      ?? '127.0.0.1',
  port:      Number(import.meta.env.VITE_NAKAMA_PORT ?? 7350),
  useSSL:    import.meta.env.VITE_NAKAMA_USE_SSL   === 'true',
  serverKey: import.meta.env.VITE_NAKAMA_SERVER_KEY ?? 'defaultkey',
} as const

export const OpCode = {
  // Server → Client
  GAME_STATE:    1,
  BOARD_UPDATE:  2,
  GAME_OVER:     3,
  PLAYER_JOINED: 4,
  PLAYER_LEFT:   5,
  // Client → Server
  MAKE_MOVE:     11,
} as const

export type OpCodeValue = typeof OpCode[keyof typeof OpCode]

export function createNakamaClient(): Client {
  return new Client(
    NakamaConfig.serverKey,
    NakamaConfig.host,
    NakamaConfig.port,
    NakamaConfig.useSSL,
  )
}
