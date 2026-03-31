# Dev Setup — Tic-Tac-Toe

This project runs a self-contained stack: Postgres + Nakama + the Go plugin, all
defined in the repo's own `docker-compose.yml`.

---

## Prerequisites

| Tool | Notes |
|------|-------|
| Docker Desktop | Must be running |
| Node.js 18+ | For the Vite frontend |

`make` is **not required** — all commands below use `docker` and `npm` directly.

---

## First-time Setup

### 1. Build the Go plugin

Run from the **repo root** (`tic-tac-toe/`):

```bash
docker build --no-cache -t tictactoe-builder -f backend/Dockerfile .
docker create --name tmp-tictactoe tictactoe-builder
docker cp tmp-tictactoe:/backend/tictactoe.so ./backend/tictactoe.so
docker rm tmp-tictactoe
```

This builds inside `heroiclabs/nakama-pluginbuilder:3.22.0` (matching ABI), generates
`game.pb.go` from `proto/game.proto` via `protoc`, and extracts `tictactoe.so`.

> Build context must be `.` (repo root), not `./backend` — `proto/` is at the root.

### 2. Start the stack

```bash
docker compose up -d
```

This starts Postgres and Nakama. Nakama auto-runs DB migrations on first start.

### 3. Verify the plugin loaded

```bash
docker compose logs nakama | grep -E "TicTacToe|Matchmaker|rpc_create"
```

Expected lines:
```
"TicTacToe plugin loaded successfully"
"Registered Go runtime Matchmaker Matched function invocation"
"Registered Go runtime RPC function invocation","id":"rpc_create_match"
"Registered Go runtime Match creation function invocation","name":"tictactoe"
```

Nakama console: http://localhost:7351 (admin / password)

### 4. Run the frontend

```bash
cd frontend
npm install        # first time only
npm run dev        # http://localhost:5173
```

The frontend connects to Nakama via these defaults (no `.env.local` changes needed
for local dev):

```
VITE_NAKAMA_HOST=127.0.0.1
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_USE_SSL=false
VITE_NAKAMA_SERVER_KEY=defaultkey
```

---

## Daily Development

### Frontend changes

Just edit files — Vite hot-reloads automatically.

### Backend (Go) changes

Each time you modify files in `backend/`:

```bash
# 1. Rebuild the plugin
docker build --no-cache -t tictactoe-builder -f backend/Dockerfile .
docker create --name tmp-tictactoe tictactoe-builder
docker cp tmp-tictactoe:/backend/tictactoe.so ./backend/tictactoe.so
docker rm tmp-tictactoe

# 2. Reload Nakama (Postgres keeps running)
docker compose restart nakama

# 3. Confirm plugin loaded
docker compose logs nakama | grep -E "TicTacToe|Matchmaker"
```

### Proto changes

If `proto/game.proto` changes, rebuild the plugin (step above). The Dockerfile runs
`protoc` inside the image — no local `protoc` needed.

For the TypeScript types regeneration (`frontend/src/gen/game_pb.ts`), see CLAUDE.md.

---

## Testing Multiplayer Locally

Both quick play and private rooms require **two separate browser sessions** with
different user accounts. Sessions are stored in `sessionStorage` (per-tab), so:

- Open Tab 1 → enter a nickname → Continue
- Open Tab 2 as a **new window/tab** (not a duplicate) → enter a different nickname → Continue

> **Do not duplicate a tab** (Ctrl+K or right-click → Duplicate). Duplicated tabs
> share sessionStorage and would log in as the same user — the matchmaker will never
> pair a user with themselves.

### Quick Play

Both tabs click **Quick Play**. Nakama matches them within a few seconds and both
navigate to the game board automatically.

### Private Room

Tab 1: **Private Room → Create Room** → lands on game page showing a room code.
Tab 2: **Private Room → Join Room** → paste the code → both navigate to the game.

---

## Tear Down

```bash
docker compose down          # stop containers, keep DB volume
docker compose down -v       # stop containers AND delete DB (full reset)
```

---

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| Port 7350/7351 in use | Another Nakama instance running | Stop the other container first |
| Plugin ABI mismatch in logs | Builder/server version mismatch | Both `Dockerfile` and `docker-compose.yml` must use the same `3.22.0` tag |
| `onmatchmakermatched` never fires | Both tabs are the same user | Open a fresh tab, not a duplicate — check sessionStorage |
| Game stuck on "Waiting for opponent..." | Matchmaker handler not registered | Verify `"Matchmaker Matched function invocation"` in Nakama logs |
| Frontend "connection refused" | Nakama not yet ready | Wait ~10s after `docker compose up`, then refresh |
| `tmp-tictactoe` already exists | Previous build left a dangling container | `docker rm tmp-tictactoe` then retry |

---

## Verification Checklist

- [ ] http://localhost:5173 — Login page renders
- [ ] http://localhost:7351 — Nakama console accessible
- [ ] Nakama logs show all four registered handlers (TicTacToe, Matchmaker, RPC, Match)
- [ ] Tab 1 + Tab 2 (fresh tabs, different nicknames): **Quick Play** → both navigate to game board
- [ ] Tab 1 + Tab 2: **Private Room** → create, share code, join → both on game board
- [ ] Moves in one tab reflect in the other; correct "Your turn" / "{name}'s turn" labels
- [ ] Game ends → Results page → Play Again → back to Lobby
