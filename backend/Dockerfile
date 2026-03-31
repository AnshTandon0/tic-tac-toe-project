# Build the Nakama Go runtime plugin as a .so shared library.
# Must use nakama-pluginbuilder — ABI must match the Nakama server image exactly.
# Build context must be the repo root (not ./backend) so proto/ is accessible:
#   docker build -t tictactoe-builder -f backend/Dockerfile .
FROM heroiclabs/nakama-pluginbuilder:3.22.0 AS builder

# Install protoc so we can generate game.pb.go inside the image (no local toolchain needed)
RUN apt-get update && apt-get install -y protobuf-compiler && rm -rf /var/lib/apt/lists/*

# Install protoc-gen-go matching the protobuf version in go.mod
RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.34.1

WORKDIR /backend

# Deps first for layer caching
COPY backend/go.mod backend/go.sum ./
RUN go mod download

# Copy backend source and proto definition
COPY backend/ .
COPY proto/ /proto/

# Generate game.pb.go from proto/game.proto
RUN mkdir -p gen && protoc \
    --proto_path=/proto \
    --go_out=gen \
    --go_opt=paths=source_relative \
    game.proto

# Sync go.sum with the current go.mod (needed after version changes)
RUN go mod tidy

# Build the plugin
RUN go build --buildmode=plugin -trimpath -o /backend/tictactoe.so .
