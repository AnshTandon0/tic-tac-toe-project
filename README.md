# Multiplayer Tic-Tac-Toe — Nakama Backend

A production-ready, server-authoritative multiplayer Tic-Tac-Toe game built with a Go/Nakama backend and a React/TypeScript frontend.

---

## Live Demo

| Service | URL |
|---------|-----|
| Frontend | https://project-h4iqv.vercel.app/ |
| Nakama Backend | http://tictactoe-backend.tryouts.tech |
| Nakama WebSocket | `ws://tictactoe-backend.tryouts.tech:7350` |
| Nakama Admin Console | `http://localhost:7351` _(SSH tunnel only — see [Deployment](#deployment))_ |

---

## Table of Contents

1. [Setup and Installation](#setup-and-installation)
2. [Architecture and Design Decisions](#architecture-and-design-decisions)
3. [API / Server Configuration](#api--server-configuration)
4. [Deployment](#deployment)
5. [How to Test Multiplayer](#how-to-test-multiplayer)
6. [Implemented Features](#implemented-features)

---

## Setup and Installation

### Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker Desktop | Latest | Must be running |
| Node.js | 18+ | For the Vite frontend |
| make | Any | Optional — all commands also listed manually |

### 1. Clone the repository

```bash
git clone <repo-url>
cd tic-tac-toe
```

### 2. Build the Go plugin

The backend is a Go shared-object plugin (`.so`). It must be compiled inside a matching builder image (ABI must match the Nakama server version). Run from the **repo root**:

```bash
docker build --no-cache -t tictactoe-builder -f backend/Dockerfile .
docker create --name tmp-tictactoe tictactoe-builder
docker cp tmp-tictactoe:/backend/tictactoe.so ./backend/tictactoe.so
docker rm tmp-tictactoe
```

Or with Make:

```bash
make build-so
```

> The `backend/Dockerfile` runs `protoc` inside the image — no local `protoc` installation needed.

### 3. Start the local stack

```bash
docker compose up -d
```

This brings up Postgres 14 and Nakama 3.22.0. Nakama auto-runs DB migrations on first start.

Verify the plugin loaded:

```bash
docker compose logs nakama | grep -E "TicTacToe|Matchmaker|rpc_create"
```

Expected output:
```
"TicTacToe plugin loaded successfully"
"Registered Go runtime Matchmaker Matched function invocation"
"Registered Go runtime RPC function invocation","id":"rpc_create_match"
"Registered Go runtime Match creation function invocation","name":"tictactoe"
```

Nakama admin console: http://localhost:7351

### 4. Run the frontend

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
```

The frontend uses these defaults out of the box (no `.env.local` changes needed for local dev):

```
VITE_NAKAMA_HOST=127.0.0.1
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_USE_SSL=false
VITE_NAKAMA_SERVER_KEY=defaultkey
```

### 5. Tear down

```bash
docker compose down        # stop containers, keep DB volume
docker compose down -v     # full reset including DB
```

---

## Architecture and Design Decisions

### Overview

```
Browser (React + Nakama JS SDK)
        |  WebSocket (proto binary)
        v
  Nakama 3.22.0  ──────────────────────────────────┐
  ├── Match Handler (tictactoe.so)                  │
  │   ├── MatchInit / MatchJoinAttempt / MatchJoin  │
  │   ├── MatchLoop  (5 ticks/sec)                  │ Docker
  │   ├── MatchLeave / MatchTerminate               │ Compose
  │   └── Leaderboard updates (nk.LeaderboardRecord)│
  └── RPC: rpc_create_match                         │
        |                                           │
  PostgreSQL 14  ←───────────────────────────────── ┘
```

### Key Decisions

#### 1. Server-Authoritative Game Logic

All game state lives in the server. The client **never updates state optimistically** — it only renders what the server broadcasts. Every `MakeMoveRequest` is validated in `handleMakeMove()`:

- Phase must be `PLAYING`
- Move must come from the player whose turn it is
- Cell index must be in `[0, 8]` and currently empty

Invalid moves are silently dropped. The client has no way to inject a winning state.

#### 2. Protobuf as Single Source of Truth

`proto/game.proto` generates both:
- `backend/gen/game.pb.go` via `protoc-gen-go`
- `frontend/src/gen/game_pb.ts` via `@protobuf-ts/plugin`

Wire format split:
- **Match data messages** (WebSocket): proto binary (`proto.Marshal` / `fromBinary`) — compact, efficient
- **RPC payloads** (`rpc_create_match`): protojson string — required by Nakama's RPC HTTP layer

#### 3. Go Plugin Architecture

The backend is a `.so` plugin mounted into the Nakama container. This means:
- No separate server process to manage
- Nakama handles all WebSocket lifecycle, presence tracking, and matchmaking queues
- The plugin only implements the 7-method `runtime.Match` interface + 2 RPC handlers

#### 4. Dual Matchmaking Modes

| Mode | Mechanism |
|------|-----------|
| Quick Play | `socket.addMatchmaker('*', 2, 2)` → Nakama's built-in matchmaker → `MatchmakerMatched` callback creates match |
| Private Room | `rpc_create_match` RPC creates match → creator shares the match ID as a room code |

#### 5. Disconnection Handling

`MatchLeave` runs immediately when a player's WebSocket closes:
- If the game is in progress, the remaining player wins by forfeit
- `GameOverMessage` is broadcast and leaderboards are updated
- No reconnection window (by design — Tic-Tac-Toe games are short)

#### 6. Leaderboard System (Bonus)

Three leaderboards are created on server boot via `nk.LeaderboardCreate`:

| Leaderboard ID | Operator | Tracks |
|----------------|----------|--------|
| `tictactoe_wins` | Increment | Total wins |
| `tictactoe_losses` | Increment | Total losses |
| `tictactoe_draws` | Increment | Total draws |

Records are updated atomically in `MatchLeave` (forfeit), `handleMakeMove` (checkmate / draw), and `MatchTerminate`.

#### 7. Concurrent Game Support (Bonus)

Each call to `MatchCreate` produces a fully isolated match instance with its own `MatchState`. Nakama routes messages to the correct instance by match ID. There is no shared mutable state between matches.

#### 8. Frontend State Management

Zustand store (`gameStore.ts`) is the single source of reactive state:
- Updated only by `useSocket.ts` dispatching decoded proto messages
- Components are pure renderers — they read from the store and call `socket.sendMatchState`
- Navigation (`/game`, `/results`) is triggered by socket events, not user actions

#### 9. Authentication

Device-based auth (`client.authenticateDevice`): generates a stable UUID per browser, stored in `localStorage`. No passwords. The username is stored in the session and broadcast to opponents via `PlayerJoinedMessage`.

---

## API / Server Configuration

### Nakama Endpoints

| Endpoint | Protocol | Purpose |
|----------|----------|---------|
| `:7350` | WebSocket (`ws://` / `wss://`) | Real-time match data |
| `:7350/v2/rpc/rpc_create_match` | HTTP POST | Create a private room |
| `:7351` | HTTP | Admin console (restricted) |

### RPC: `rpc_create_match`

**Request:** empty JSON body `{}`

**Response:**
```json
{ "matchId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" }
```

### Opcode Table

| Opcode | Direction | Message | Trigger |
|--------|-----------|---------|---------|
| 1 | S→C | `GameStateMessage` | Full sync sent to each player on join |
| 2 | S→C | `BoardUpdateMessage` | After every valid move |
| 3 | S→C | `GameOverMessage` | Win / draw / forfeit / server shutdown |
| 4 | S→C | `PlayerJoinedMessage` | When a player joins the match |
| 5 | S→C | `PlayerLeftMessage` | When a player disconnects |
| 11 | C→S | `MakeMoveRequest` | Player clicks a cell |
| 12 | C→S | `RematchReadyRequest` | Player requests a rematch |
| 13 | S→C | `RematchAcceptedMessage` | New match ID when both players rematch |

### Match Lifecycle

```
MatchInit → MatchJoinAttempt (×2) → MatchJoin (×2)
         → MatchLoop @ 5Hz (processes moves)
         → [MatchLeave on disconnect]
         → MatchTerminate on server shutdown
```

Match label is `{"open":true}` while waiting for the second player, then `{"open":false}` once both are present.

### Environment Variables

**Frontend** (Vite):

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_NAKAMA_HOST` | `127.0.0.1` | Nakama server hostname |
| `VITE_NAKAMA_PORT` | `7350` | Nakama WebSocket port |
| `VITE_NAKAMA_USE_SSL` | `false` | Use `wss://` and `https://` |
| `VITE_NAKAMA_SERVER_KEY` | `defaultkey` | Must match server's `--socket.server_key` |

**Backend** (`.env.prod`):

| Variable | Description |
|----------|-------------|
| `DB_PASSWORD` | PostgreSQL password |
| `NAKAMA_SERVER_KEY` | Client authentication key |
| `RUNTIME_HTTP_KEY` | Server-to-server RPC key |
| `CONSOLE_USERNAME` | Admin console login |
| `CONSOLE_PASSWORD` | Admin console password |

Copy `.env.prod.example` to `.env.prod` and fill in real values. Never commit `.env.prod`.

---

## Deployment

### Infrastructure

| Component | Platform |
|-----------|----------|
| Nakama + PostgreSQL | AWS EC2 (Docker Compose) |
| Frontend | Vercel |
| CI/CD | GitHub Actions |

### Backend: AWS EC2

**First-time EC2 setup:**

```bash
# On the EC2 instance
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-plugin
sudo usermod -aG docker ubuntu

# Clone the repo
git clone <repo-url> /home/ubuntu/tic-tac-toe
cd /home/ubuntu/tic-tac-toe

# Create production env file
cp .env.prod.example .env.prod
# Edit .env.prod with real secrets

# Build the .so
docker build --no-cache -t tictactoe-builder -f backend/Dockerfile .
docker create --name tmp-tictactoe tictactoe-builder
docker cp tmp-tictactoe:/backend/tictactoe.so ./backend/tictactoe.so
docker rm tmp-tictactoe

# Start the stack
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d
```

**Access the admin console via SSH tunnel (never expose 7351 publicly):**

```bash
ssh -L 7351:localhost:7351 ubuntu@<EC2_HOST>
# Then open http://localhost:7351 in your browser
```

### Automated CI/CD (GitHub Actions)

Every push to `master` that touches `backend/**` or `proto/**` triggers `.github/workflows/deploy-backend.yml`:

1. Builds `tictactoe.so` in Docker
2. SCPs the `.so` to the EC2 instance
3. SSHs in and runs `docker compose restart nakama`

**Required GitHub Secrets:**

| Secret | Value |
|--------|-------|
| `EC2_HOST` | Public IP or hostname of the EC2 instance |
| `EC2_SSH_KEY` | Private SSH key (PEM) for the `ubuntu` user |

### Frontend: Vercel

1. Import the repository in Vercel
2. Set root directory to `frontend/`
3. Add these environment variables in the Vercel dashboard:

```
VITE_NAKAMA_HOST=tictactoe-backend.tryouts.tech
VITE_NAKAMA_PORT=7350
VITE_NAKAMA_USE_SSL=false
VITE_NAKAMA_SERVER_KEY=<value from .env.prod NAKAMA_SERVER_KEY>
```

4. Deploy — Vercel runs `npm run build` automatically.

### Proto Regeneration

If `proto/game.proto` changes:
- **Go types** (`backend/gen/game.pb.go`): regenerated automatically inside the Dockerfile during `build-so`
- **TypeScript types** (`frontend/src/gen/game_pb.ts`): run `make proto` locally (requires `protoc ≥ 25.x` and `@protobuf-ts/plugin`)

---

## How to Test Multiplayer

Multiplayer requires **two separate browser sessions** with different user accounts. Sessions are stored in `sessionStorage` (per-tab), so:

> Do **not** duplicate a tab (Ctrl+K or right-click → Duplicate). Duplicated tabs share `sessionStorage` and will log in as the same user — the matchmaker will never pair a player with themselves.

### Quick Play

1. Open **Tab 1** → enter nickname (e.g. `Alice`) → Continue
2. Open a **new window/tab** → enter a different nickname (e.g. `Bob`) → Continue
3. Both tabs: click **Quick Play**
4. Nakama matches them within a few seconds → both navigate to the game board automatically
5. Click cells alternately — moves in one tab reflect immediately in the other

### Private Room

1. **Tab 1**: click **Private Room → Create Room** → a room code (match ID) appears
2. **Tab 2**: click **Private Room → Join Room** → paste the code → Join
3. Both tabs navigate to the game board

### Verifying Game Events

| Scenario | Expected behaviour |
|----------|--------------------|
| Valid move | Board updates in both tabs; turn indicator flips |
| Invalid move (wrong turn) | Move is ignored; board unchanged |
| Win | Winning line highlighted; Results page shows winner |
| Draw | All 9 cells filled; Results page shows "Draw" |
| Player closes tab | Opponent wins by forfeit; Results page shown immediately |
| "Play Again" | Both return to Lobby; new match can be started |

### Checking Nakama Logs

```bash
docker compose logs -f nakama
```

Look for:
- `"MakeMoveRequest"` — each move received
- `"GameOverMessage"` — game end with winner
- `"MatchLeave"` — player disconnect

### Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `onmatchmakermatched` never fires | Both tabs are same user | Open a fresh tab, not a duplicate — check `sessionStorage` |
| "Waiting for opponent..." forever | Matchmaker not registered | Check logs for `"Matchmaker Matched function invocation"` |
| Frontend "connection refused" | Nakama not yet ready | Wait ~10s after `docker compose up`, then refresh |
| `tmp-tictactoe` container error | Previous build left a dangling container | `docker rm tmp-tictactoe` then retry |
| Plugin ABI mismatch in logs | Builder/server version mismatch | Both `Dockerfile` and `docker-compose.yml` must use `3.22.0` |

---

## Implemented Features

### Core Requirements

- [x] Server-authoritative game logic (all moves validated server-side)
- [x] Automatic matchmaking (Nakama built-in matchmaker queue)
- [x] Private room creation and joining via room code
- [x] Player disconnection handling with forfeit win
- [x] Real-time state broadcast via WebSocket proto binary
- [x] Deployed Nakama backend on AWS EC2
- [x] Deployed frontend on Vercel

### Bonus Features

- [x] **Concurrent game support** — each match is a fully isolated Nakama match instance
- [x] **Leaderboard system** — tracks wins, losses, and draws per player (`tictactoe_wins`, `tictactoe_losses`, `tictactoe_draws`)
- [x] **CI/CD pipeline** — GitHub Actions auto-deploys backend on push to master
