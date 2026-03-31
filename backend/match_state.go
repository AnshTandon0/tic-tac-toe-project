package main

import (
	"context"
	"tictactoe/gen"

	"github.com/heroiclabs/nakama-common/runtime"
)

// winLines contains all 8 possible winning combinations on a 3×3 board.
// Indices are row-major: top-left=0, bottom-right=8.
var winLines = [8][3]int{
	{0, 1, 2}, // top row
	{3, 4, 5}, // middle row
	{6, 7, 8}, // bottom row
	{0, 3, 6}, // left column
	{1, 4, 7}, // middle column
	{2, 5, 8}, // right column
	{0, 4, 8}, // diagonal top-left → bottom-right
	{2, 4, 6}, // diagonal top-right → bottom-left
}

// MatchState holds all mutable state for one authoritative match.
// It is passed by pointer through every Match interface method.
type MatchState struct {
	// Board represents the 3×3 grid in row-major order (indices 0–8).
	// Values: "" (empty) | "X" | "O"
	Board [9]string

	// PlayerX is the Nakama user ID of the first player to join.
	// PlayerO is the second. Assigned in MatchJoin, never change after.
	PlayerX string
	PlayerO string

	// Usernames maps user ID → Nakama display name.
	Usernames map[string]string

	// CurrentTurn holds the user ID of the player whose turn it is.
	// "" while Phase == WAITING.
	CurrentTurn string

	// Phase tracks the lifecycle state of this match.
	Phase gen.MatchPhase

	// Presences maps user ID → runtime.Presence.
	// Used to send targeted messages (e.g. GameStateMessage on join).
	Presences map[string]runtime.Presence

	// TickRate stored here for reference (returned from MatchInit).
	TickRate int
}

// NewMatchState returns a freshly initialised MatchState.
func NewMatchState() *MatchState {
	return &MatchState{
		Board:     [9]string{},
		Usernames: make(map[string]string),
		Presences: make(map[string]runtime.Presence),
		Phase:     gen.MatchPhase_MATCH_PHASE_WAITING,
		TickRate:  5,
	}
}

// symbolFor returns the proto Symbol enum for a given user ID.
// Used to populate PlayerJoinedMessage.Symbol.
func (s *MatchState) symbolFor(userID string) gen.Symbol {
	if userID == s.PlayerX {
		return gen.Symbol_SYMBOL_X
	}
	return gen.Symbol_SYMBOL_O
}

// symbolStr converts a proto Symbol enum to the string stored on the board.
// Board cells always hold "" | "X" | "O" — not the numeric enum.
func symbolStr(sym gen.Symbol) string {
	if sym == gen.Symbol_SYMBOL_X {
		return "X"
	}
	return "O"
}

// boardSlice converts the fixed [9]string array to a []string slice
// for use in proto repeated string fields.
func (s *MatchState) boardSlice() []string {
	return s.Board[:]
}

// checkWinner inspects all 8 win lines.
// Returns the winning user ID and the three cell indices, or ("", nil) if no winner.
// Board comparisons use strings only — gen.Symbol is never compared to strings.
func (s *MatchState) checkWinner() (winnerID string, winLine []int32) {
	for _, line := range winLines {
		a, b, c := s.Board[line[0]], s.Board[line[1]], s.Board[line[2]]
		if a != "" && a == b && b == c {
			if a == "X" {
				return s.PlayerX, []int32{int32(line[0]), int32(line[1]), int32(line[2])}
			}
			return s.PlayerO, []int32{int32(line[0]), int32(line[1]), int32(line[2])}
		}
	}
	return "", nil
}

// isBoardFull returns true when every cell is occupied (draw condition).
func (s *MatchState) isBoardFull() bool {
	for _, cell := range s.Board {
		if cell == "" {
			return false
		}
	}
	return true
}

// handleMakeMove validates and applies a player's move, then broadcasts
// either a BoardUpdateMessage (normal move) or GameOverMessage (win/draw).
// Invalid moves are silently dropped — no error is sent to the client.
func handleMakeMove(
	ctx        context.Context,
	s          *MatchState,
	dispatcher runtime.MatchDispatcher,
	nk         runtime.NakamaModule,
	userID     string,
	req        *gen.MakeMoveRequest,
	logger     runtime.Logger,
) {
	// Validation chain — all failures are silent drops.
	if s.Phase != gen.MatchPhase_MATCH_PHASE_PLAYING {
		return
	}
	if userID != s.CurrentTurn {
		return
	}
	if req.CellIndex < 0 || req.CellIndex > 8 {
		return
	}
	if s.Board[req.CellIndex] != "" {
		return
	}

	// Apply move.
	s.Board[req.CellIndex] = symbolStr(s.symbolFor(userID))

	winner, winLine := s.checkWinner()

	if winner != "" {
		// Win condition.
		s.Phase = gen.MatchPhase_MATCH_PHASE_OVER
		if err := dispatcher.BroadcastMessage(
			OpCodeGameOver,
			mustMarshal(&gen.GameOverMessage{
				Board:   s.boardSlice(),
				Winner:  winner,
				WinLine: winLine,
				PlayerX: s.PlayerX,
				PlayerO: s.PlayerO,
			}),
			nil, nil, true,
		); err != nil {
			logger.Warn("BroadcastMessage GameOver failed", "err", err.Error())
		}
		loser := s.PlayerO
		if winner == s.PlayerO {
			loser = s.PlayerX
		}
		if _, err := nk.LeaderboardRecordWrite(ctx, "tictactoe_wins", winner, s.Usernames[winner], 1, 0, nil, nil); err != nil {
			logger.Warn("LeaderboardRecordWrite win failed", "err", err.Error())
		}
		if _, err := nk.LeaderboardRecordWrite(ctx, "tictactoe_losses", loser, s.Usernames[loser], 1, 0, nil, nil); err != nil {
			logger.Warn("LeaderboardRecordWrite loss failed", "err", err.Error())
		}
		return
	}

	if s.isBoardFull() {
		// Draw condition.
		s.Phase = gen.MatchPhase_MATCH_PHASE_OVER
		if err := dispatcher.BroadcastMessage(
			OpCodeGameOver,
			mustMarshal(&gen.GameOverMessage{
				Board:   s.boardSlice(),
				Winner:  "", // empty string = draw
				WinLine: []int32{},
				PlayerX: s.PlayerX,
				PlayerO: s.PlayerO,
			}),
			nil, nil, true,
		); err != nil {
			logger.Warn("BroadcastMessage Draw failed", "err", err.Error())
		}
		if _, err := nk.LeaderboardRecordWrite(ctx, "tictactoe_draws", s.PlayerX, s.Usernames[s.PlayerX], 1, 0, nil, nil); err != nil {
			logger.Warn("LeaderboardRecordWrite draw (X) failed", "err", err.Error())
		}
		if _, err := nk.LeaderboardRecordWrite(ctx, "tictactoe_draws", s.PlayerO, s.Usernames[s.PlayerO], 1, 0, nil, nil); err != nil {
			logger.Warn("LeaderboardRecordWrite draw (O) failed", "err", err.Error())
		}
		return
	}

	// Normal move — flip turn.
	if s.CurrentTurn == s.PlayerX {
		s.CurrentTurn = s.PlayerO
	} else {
		s.CurrentTurn = s.PlayerX
	}

	if err := dispatcher.BroadcastMessage(
		OpCodeBoardUpdate,
		mustMarshal(&gen.BoardUpdateMessage{
			Board:       s.boardSlice(),
			CurrentTurn: s.CurrentTurn,
			MoveIndex:   req.CellIndex,
			MovedBy:     userID,
		}),
		nil, nil, true,
	); err != nil {
		logger.Warn("BroadcastMessage BoardUpdate failed", "err", err.Error())
	}
}
