import { useEffect } from 'react'
import { NavigateFunction } from 'react-router-dom'
import { useNakama } from 'hooks/useNakama'
import { useGameStore } from 'store/gameStore'
import { OpCode } from 'config/nakama'
import {
  GameStateMessage,
  BoardUpdateMessage,
  GameOverMessage,
  PlayerJoinedMessage,
  PlayerLeftMessage,
  MatchPhase,
} from 'gen/game_pb'

export function useSocket(navigate: NavigateFunction): void {
  const { socket, session } = useNakama()

  useEffect(() => {
    if (!socket || !session) return

    socket.onmatchdata = (data) => {
      const bytes = new Uint8Array(data.data as ArrayBuffer)

      try {
        switch (data.op_code) {
          case OpCode.GAME_STATE: {
            const msg = GameStateMessage.fromBinary(bytes)
            useGameStore.getState().applyGameState(msg, session.user_id)
            if (msg.phase === MatchPhase.MATCH_PHASE_PLAYING) navigate('/game')
            break
          }
          case OpCode.BOARD_UPDATE: {
            const msg = BoardUpdateMessage.fromBinary(bytes)
            useGameStore.getState().applyBoardUpdate(msg)
            break
          }
          case OpCode.GAME_OVER: {
            const msg = GameOverMessage.fromBinary(bytes)
            useGameStore.getState().applyGameOver(msg)
            navigate('/results')
            break
          }
          case OpCode.PLAYER_JOINED: {
            const msg = PlayerJoinedMessage.fromBinary(bytes)
            useGameStore.getState().applyPlayerJoined(msg)
            break
          }
          case OpCode.PLAYER_LEFT: {
            const msg = PlayerLeftMessage.fromBinary(bytes)
            useGameStore.getState().applyPlayerLeft(msg)
            break
          }
          default:
            console.warn('Unknown opcode received:', data.op_code)
        }
      } catch (err) {
        console.warn('Failed to decode match data for opcode', data.op_code, err)
      }
    }

    return () => {
      socket.onmatchdata = undefined
    }
  }, [socket, session, navigate])
}
