package main

import "google.golang.org/protobuf/proto"

// mustMarshal serialises a proto.Message to bytes.
// Panics on error — proto.Marshal only fails on programmer error
// (invalid proto.Message implementation), never on valid generated types.
func mustMarshal(m proto.Message) []byte {
	data, err := proto.Marshal(m)
	if err != nil {
		panic("proto.Marshal failed: " + err.Error())
	}
	return data
}

// safeUnmarshal deserialises bytes into a proto.Message.
// Returns false if unmarshalling fails (malformed client payload).
// NOTE: Unlike mustMarshal (which panics), this returns bool — use in
// MatchLoop to silently drop malformed client messages.
func safeUnmarshal(data []byte, m proto.Message) bool {
	return proto.Unmarshal(data, m) == nil
}
