## ADDED Requirements

### Requirement: OpenCode CLI Detection

The system MUST detect OpenCode CLI availability and expose installation metadata.

#### Scenario: OpenCode installed

- **GIVEN** `opencode` exists in PATH
- **WHEN** engine detection runs
- **THEN** the system returns `EngineStatus` with `engine_type=OpenCode`, `installed=true`, and parsed version metadata

#### Scenario: OpenCode missing

- **GIVEN** `opencode` is not found in PATH
- **WHEN** engine detection runs
- **THEN** the system returns `EngineStatus` with `engine_type=OpenCode`, `installed=false`, and an actionable error
  string

### Requirement: OpenCode Session Runtime

The system MUST provide a dedicated OpenCode session runtime for message sending, resume, and interrupt.

#### Scenario: send message with streaming events

- **GIVEN** OpenCode is active for a workspace
- **WHEN** user sends a prompt
- **THEN** backend starts OpenCode CLI in stream-json mode and emits unified `EngineEvent` updates

#### Scenario: interrupt OpenCode turn

- **GIVEN** an OpenCode process is actively generating output
- **WHEN** user triggers interrupt
- **THEN** backend terminates the active process and emits terminal error/completion behavior without hanging the UI

### Requirement: Three-Way Frontend Routing

The frontend MUST route message sending by explicit engine branch (`claude`, `codex`, `opencode`).

#### Scenario: OpenCode route isolation

- **GIVEN** active engine is `opencode`
- **WHEN** user sends a message
- **THEN** frontend calls engine-based send APIs and MUST NOT call Codex `sendUserMessage` path

### Requirement: OpenCode Engine Availability in UI

The engine selector MUST treat OpenCode as implemented (installable/selectable) rather than coming-soon.

#### Scenario: render engine selector status

- **GIVEN** engine list includes OpenCode detection data
- **WHEN** selector renders
- **THEN** OpenCode appears with installed/not-installed state semantics consistent with implemented engines
