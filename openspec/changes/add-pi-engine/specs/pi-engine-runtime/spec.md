## ADDED Requirements

### Requirement: PI CLI print-mode runtime

The system MUST run PI CLI via `pi --print --mode json` with optional `--model`, `--session-id`, and `--thinking`, and map NDJSON events to the unified engine event bus.

#### Scenario: Stream text and tools

- **WHEN** a user sends a message with engine `pi`
- **THEN** the host spawns PI in print json mode and emits text deltas, reasoning deltas, tool start/end, and a terminal turn event

#### Scenario: Resume session

- **WHEN** continue_session is true and a session id is known
- **THEN** the host passes `--session-id <id>` to PI
