import { NavigateFunction } from 'react-router-dom'
import { useNakama } from 'hooks/useNakama'
import { useGameStore } from 'store/gameStore'
import { CreateMatchResponse } from 'gen/game_pb'
import { MatchmakingStatus } from 'types/game'

export interface UseMatchmakerReturn {
  startMatchmaking:   ()                 => Promise<void>
  cancelMatchmaking:  ()                 => Promise<void>
  createPrivateRoom:  ()                 => Promise<string>
  joinPrivateRoom:    (matchId: string)  => Promise<void>
  mmStatus:           MatchmakingStatus
  mmError:            string | null
}

export function useMatchmaker(navigate: NavigateFunction): UseMatchmakerReturn {
  const { client, session, socket } = useNakama()
  const store = useGameStore()

  async function startMatchmaking(): Promise<void> {
    store.setMmStatus('searching')
    store.setMmError(null)

    try {
      const ticket = await socket!.addMatchmaker('*', 2, 2)
      store.setMmTicket(ticket.ticket)

      socket!.onmatchmakermatched = async (matched) => {
        store.setMmStatus('joining')
        const matchId = matched.match_id ?? matched.token ?? ''
        await socket!.joinMatch(matchId)
        store.setMatchId(matchId)
        store.setMmStatus('in_match')
        store.setMmTicket(null)
        navigate('/game')
      }
    } catch {
      store.setMmStatus('idle')
      store.setMmError('Matchmaking failed. Please try again.')
    }
  }

  async function cancelMatchmaking(): Promise<void> {
    const ticket = useGameStore.getState().mmTicket
    if (!ticket) return

    try {
      await socket!.removeMatchmaker(ticket)
    } finally {
      store.setMmStatus('idle')
      store.setMmTicket(null)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (socket) (socket as any).onmatchmakermatched = undefined
    }
  }

  async function createPrivateRoom(): Promise<string> {
    const result = await client.rpc(session!, 'rpc_create_match', {})
    const resp   = CreateMatchResponse.fromJson(
      result.payload as Record<string, unknown>,
    )

    await socket!.joinMatch(resp.matchId)
    store.setMatchId(resp.matchId)
    store.setMmStatus('in_match')
    navigate('/game')
    return resp.matchId
  }

  async function joinPrivateRoom(matchId: string): Promise<void> {
    await socket!.joinMatch(matchId)
    store.setMatchId(matchId)
    store.setMmStatus('in_match')
    navigate('/game')
  }

  return {
    startMatchmaking,
    cancelMatchmaking,
    createPrivateRoom,
    joinPrivateRoom,
    mmStatus: store.mmStatus,
    mmError:  store.mmError,
  }
}
