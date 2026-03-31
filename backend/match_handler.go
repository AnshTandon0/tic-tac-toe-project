package main

import (
	"context"
	"database/sql"
	"tictactoe/gen"

	"github.com/heroiclabs/nakama-common/runtime"
)

// TicTacToeMatch is the match handler registered with Nakama.
// It is stateless — all game state lives in *MatchState passed between calls.
type TicTacToeMatch struct{}

// newTicTacToeMatch is the factory function registered in InitModule.
func newTicTacToeMatch(
	_ context.Context,
	_ runtime.Logger,
	_ *sql.DB,
	_ runtime.NakamaModule,
) (runtime.Match, error) {
	return &TicTacToeMatch{}, nil
}

// MatchInit is called once when the match is created (via nk.MatchCreate or matchmaker).
// Returns initial state, tick rate, and label.
func (m *TicTacToeMatch) MatchInit(
	_ context.Context,
	_ runtime.Logger,
	_ *sql.DB,
	_ runtime.NakamaModule,
	_ map[string]interface{},
) (interface{}, int, string) {
	state := NewMatchState()
	// {"open":true} makes this match discoverable by the matchmaker.
	// Updated to {"open":false} in MatchJoin when the 2nd player arrives.
	label := `{"open":true}`
	return state, state.TickRate, label
}

// MatchJoinAttempt is called synchronously before a player physically joins.
// Return allow=false to reject.
func (m *TicTacToeMatch) MatchJoinAttempt(
	_ context.Context,
	_ runtime.Logger,
	_ *sql.DB,
	_ runtime.NakamaModule,
	_ runtime.MatchDispatcher,
	_ int64,
	state interface{},
	presence runtime.Presence,
	_ map[string]string,
) (interface{}, bool, string) {
	s := state.(*MatchState)

	if len(s.Presences) >= 2 {
		return s, false, "match is full"
	}
	if s.Phase == gen.MatchPhase_MATCH_PHASE_OVER {
		return s, false, "match has ended"
	}
	_ = presence // accepted, no metadata inspection needed
	return s, true, ""
}

// MatchJoin is called after MatchJoinAttempt returned allow=true.
// presences contains all newly admitted players this tick (usually 1).
func (m *TicTacToeMatch) MatchJoin(
	_ context.Context,
	logger runtime.Logger,
	_ *sql.DB,
	_ runtime.NakamaModule,
	dispatcher runtime.MatchDispatcher,
	_ int64,
	state interface{},
	presences []runtime.Presence,
) interface{} {
	s := state.(*MatchState)

	for _, p := range presences {
		uid := p.GetUserId()
		s.Presences[uid] = p
		s.Usernames[uid] = p.GetUsername()

		// Assign symbol: first joiner = X, second = O.
		if s.PlayerX == "" {
			s.PlayerX = uid
		} else {
			s.PlayerO = uid
		}

		// Broadcast PlayerJoined to ALL current presences (including existing player).
		if err := dispatcher.BroadcastMessage(
			OpCodePlayerJoined,
			mustMarshal(&gen.PlayerJoinedMessage{
				PlayerId: uid,
				Symbol:   s.symbolFor(uid),
				Username: p.GetUsername(),
			}),
			nil, nil, true,
		); err != nil {
			logger.Warn("BroadcastMessage PlayerJoined failed", "err", err.Error())
		}

		// Catch-up: send PlayerJoined for every already-present player to this new joiner.
		for existingUID := range s.Presences {
			if existingUID == uid {
				continue // skip self
			}
			if err := dispatcher.BroadcastMessage(
				OpCodePlayerJoined,
				mustMarshal(&gen.PlayerJoinedMessage{
					PlayerId: existingUID,
					Symbol:   s.symbolFor(existingUID),
					Username: s.Usernames[existingUID],
				}),
				[]runtime.Presence{p}, nil, true,
			); err != nil {
				logger.Warn("BroadcastMessage PlayerJoined (catch-up) failed", "err", err.Error())
			}
		}
	}

	// Start game when both players are present.
	if s.PlayerX != "" && s.PlayerO != "" && s.Phase == gen.MatchPhase_MATCH_PHASE_WAITING {
		s.Phase = gen.MatchPhase_MATCH_PHASE_PLAYING
		s.CurrentTurn = s.PlayerX
		if err := dispatcher.MatchLabelUpdate(`{"open":false}`); err != nil {
			logger.Warn("MatchLabelUpdate failed", "err", err.Error())
		}
	}

	// Send GameStateMessage to each new joiner when waiting, or broadcast to ALL when
	// the game just started so the existing player also learns the PLAYING phase.
	gameStateBytes := mustMarshal(&gen.GameStateMessage{
		Board:       s.boardSlice(),
		PlayerX:     s.PlayerX,
		PlayerO:     s.PlayerO,
		CurrentTurn: s.CurrentTurn,
		Phase:       s.Phase,
	})
	for _, p := range presences {
		var targets []runtime.Presence
		if s.Phase != gen.MatchPhase_MATCH_PHASE_PLAYING {
			targets = []runtime.Presence{p} // only this joiner while still waiting
		}
		// targets == nil → broadcast to all (used when game just started)
		if err := dispatcher.BroadcastMessage(
			OpCodeGameState, gameStateBytes, targets, nil, true,
		); err != nil {
			logger.Warn("BroadcastMessage GameState failed", "err", err.Error())
		}
	}

	return s
}

// MatchLeave is called when a presence leaves (disconnect, explicit leave, or kick).
func (m *TicTacToeMatch) MatchLeave(
	ctx context.Context,
	logger runtime.Logger,
	_ *sql.DB,
	nk runtime.NakamaModule,
	dispatcher runtime.MatchDispatcher,
	_ int64,
	state interface{},
	presences []runtime.Presence,
) interface{} {
	s := state.(*MatchState)

	for _, p := range presences {
		uid := p.GetUserId()
		delete(s.Presences, uid)

		// Notify remaining player(s).
		if err := dispatcher.BroadcastMessage(
			OpCodePlayerLeft,
			mustMarshal(&gen.PlayerLeftMessage{PlayerId: uid}),
			nil, nil, true,
		); err != nil {
			logger.Warn("BroadcastMessage PlayerLeft failed", "err", err.Error())
		}

		// Forfeit: if game was in progress, the remaining player wins.
		if s.Phase == gen.MatchPhase_MATCH_PHASE_PLAYING {
			var winner string
			if uid == s.PlayerX {
				winner = s.PlayerO
			} else {
				winner = s.PlayerX
			}
			s.Phase = gen.MatchPhase_MATCH_PHASE_OVER

			if err := dispatcher.BroadcastMessage(
				OpCodeGameOver,
				mustMarshal(&gen.GameOverMessage{
					Board:   s.boardSlice(),
					Winner:  winner,
					WinLine: []int32{}, // no win line for forfeit
					PlayerX: s.PlayerX,
					PlayerO: s.PlayerO,
				}),
				nil, nil, true,
			); err != nil {
				logger.Warn("BroadcastMessage GameOver (forfeit) failed", "err", err.Error())
			}
			if _, err := nk.LeaderboardRecordWrite(ctx, "tictactoe_wins", winner, s.Usernames[winner], 1, 0, nil, nil); err != nil {
				logger.Warn("LeaderboardRecordWrite forfeit win failed", "err", err.Error())
			}
			if _, err := nk.LeaderboardRecordWrite(ctx, "tictactoe_losses", uid, s.Usernames[uid], 1, 0, nil, nil); err != nil {
				logger.Warn("LeaderboardRecordWrite forfeit loss failed", "err", err.Error())
			}
		}
	}

	return s
}

// MatchLoop is called every tick (5×/sec). All client messages since the last
// tick are passed in messages.
func (m *TicTacToeMatch) MatchLoop(
	ctx context.Context,
	logger runtime.Logger,
	_ *sql.DB,
	_ runtime.NakamaModule,
	dispatcher runtime.MatchDispatcher,
	tick int64,
	state interface{},
	messages []runtime.MatchData,
) interface{} {
	s := state.(*MatchState)

	for _, msg := range messages {
		switch msg.GetOpCode() {
		case OpCodeMakeMove:
			var req gen.MakeMoveRequest
			if !safeUnmarshal(msg.GetData(), &req) {
				logger.Warn("invalid MakeMoveRequest payload", "userId", msg.GetUserId())
				continue
			}
			handleMakeMove(ctx, s, dispatcher, nk, msg.GetUserId(), &req, logger)

		default:
			// Silently drop unknown or server-direction opcodes from clients.
		}
	}

	// Idle timeout: terminate if no 2nd player joined within 60 seconds.
	const idleTimeoutTicks = 300 // 60s × 5 ticks/s
	if s.Phase == gen.MatchPhase_MATCH_PHASE_WAITING && tick > idleTimeoutTicks {
		logger.Info("match idle timeout, terminating")
		return nil // nil state → Nakama calls MatchTerminate
	}

	return s
}

// MatchSignal satisfies the runtime.Match interface. Not used in this game.
func (m *TicTacToeMatch) MatchSignal(
	_ context.Context,
	_ runtime.Logger,
	_ *sql.DB,
	_ runtime.NakamaModule,
	_ runtime.MatchDispatcher,
	_ int64,
	state interface{},
	_ string,
) (interface{}, string) {
	return state, ""
}

// MatchTerminate is called when the match is shutting down (nil returned from
// MatchLoop, or Nakama server shutdown).
func (m *TicTacToeMatch) MatchTerminate(
	_ context.Context,
	logger runtime.Logger,
	_ *sql.DB,
	_ runtime.NakamaModule,
	dispatcher runtime.MatchDispatcher,
	_ int64,
	state interface{},
	_ int,
) interface{} {
	if err := dispatcher.BroadcastMessage(
		OpCodeGameOver,
		mustMarshal(&gen.GameOverMessage{Winner: "server_shutdown"}),
		nil, nil, true,
	); err != nil {
		logger.Warn("BroadcastMessage MatchTerminate failed", "err", err.Error())
	}
	return state
}
