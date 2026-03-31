package main

import (
	"context"
	"database/sql"
	"tictactoe/gen"

	"github.com/heroiclabs/nakama-common/runtime"
	"google.golang.org/protobuf/encoding/protojson"
)

// RpcCreateMatch is called by the frontend via HTTP POST /v2/rpc/rpc_create_match.
// It creates a new authoritative match and returns the match ID as protojson.
// The client then calls socket.joinMatch(matchId) to enter the match.
//
// This RPC is needed because nk.MatchCreate() is server-side only —
// clients have no direct API to create an authoritative match.
func RpcCreateMatch(
	ctx     context.Context,
	logger  runtime.Logger,
	_       *sql.DB,
	nk      runtime.NakamaModule,
	payload string,
) (string, error) {
	// CreateMatchRequest has no fields — nothing to parse.

	// Create a new authoritative match using the registered "tictactoe" handler.
	matchID, err := nk.MatchCreate(ctx, "tictactoe", map[string]interface{}{})
	if err != nil {
		logger.Error("failed to create match", "err", err.Error())
		return "", runtime.NewError("could not create match", 13) // INTERNAL
	}

	// Encode response as protojson (Nakama RPC payloads are strings).
	resp, err := protojson.Marshal(&gen.CreateMatchResponse{MatchId: matchID})
	if err != nil {
		return "", runtime.NewError("response serialisation failed", 13)
	}

	logger.Info("match created via RPC", "matchId", matchID)
	return string(resp), nil
}
