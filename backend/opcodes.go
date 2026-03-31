package main

// Server → Client opcodes (1–10 reserved range)
const (
	OpCodeGameState    int64 = 1
	OpCodeBoardUpdate  int64 = 2
	OpCodeGameOver     int64 = 3
	OpCodePlayerJoined int64 = 4
	OpCodePlayerLeft   int64 = 5
)

// Client → Server opcodes (11–20 reserved range)
const (
	OpCodeMakeMove int64 = 11
)

// Range split is intentional:
//   1–10  reserved for server→client pushes
//   11–20 reserved for client→server actions
// Any opcode < 11 received from a client is silently dropped in MatchLoop.
