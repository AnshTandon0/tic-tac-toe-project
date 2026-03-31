package main

import (
	"context"
	"database/sql"

	"github.com/heroiclabs/nakama-common/runtime"
)

// MatchmakerMatched is called by Nakama when enough players are queued via addMatchmaker.
// It creates an authoritative "tictactoe" match and returns the match ID so that
// all matched players receive it via the onmatchmakermatched socket event.
func MatchmakerMatched(
	ctx    context.Context,
	logger runtime.Logger,
	_      *sql.DB,
	nk     runtime.NakamaModule,
	entries []runtime.MatchmakerEntry,
) (string, error) {
	matchID, err := nk.MatchCreate(ctx, "tictactoe", map[string]interface{}{})
	if err != nil {
		logger.Error("matchmaker: failed to create match", "err", err.Error())
		return "", runtime.NewError("could not create match", 13)
	}
	logger.Info("matchmaker: authoritative match created", "matchId", matchID, "players", len(entries))
	return matchID, nil
}
