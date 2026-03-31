package main

import (
	"context"
	"database/sql"

	"github.com/heroiclabs/nakama-common/runtime"
)

// InitModule is the required entry point for a Nakama Go runtime plugin.
// Called once on server startup when the .so is loaded.
func InitModule(
	_ context.Context,
	logger runtime.Logger,
	_ *sql.DB,
	_ runtime.NakamaModule,
	initializer runtime.Initializer,
) error {
	// Register the match handler under the name "tictactoe".
	// This name is used in nk.MatchCreate() and the matchmaker label query.
	if err := initializer.RegisterMatch("tictactoe", newTicTacToeMatch); err != nil {
		return err
	}

	// Register the matchmaker handler so quick-play creates an authoritative match.
	// Without this, Nakama creates a relayed (non-authoritative) match and the
	// TicTacToeMatch handler never runs — no GAME_STATE is sent to clients.
	if err := initializer.RegisterMatchmakerMatched(MatchmakerMatched); err != nil {
		return err
	}

	// Register the create-match RPC.
	// RPC ID maps to: POST /v2/rpc/rpc_create_match
	if err := initializer.RegisterRpc("rpc_create_match", RpcCreateMatch); err != nil {
		return err
	}

	logger.Info("TicTacToe plugin loaded successfully")
	return nil
}
