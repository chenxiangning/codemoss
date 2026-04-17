# opencode-engine Specification Delta

## MODIFIED Requirements

### Requirement: Three-Way Frontend Routing

The frontend MUST route message sending and interruption by deterministic engine ownership, not only current UI selection.

#### Scenario: send route follows thread ownership

- **GIVEN** a thread id prefixed with `codex` domain (non `claude:` and non `opencode:`)
- **AND** current selected engine in UI is `opencode`
- **WHEN** user sends a new message to that existing thread
- **THEN** system routes to Codex send path
- **AND** MUST NOT route to OpenCode send path

#### Scenario: interrupt route follows thread ownership

- **GIVEN** a thread id prefixed with `opencode:`
- **AND** current selected engine in UI is `claude`
- **WHEN** user interrupts the running turn
- **THEN** system routes to OpenCode interrupt path
- **AND** MUST NOT route to Codex interrupt rpc path

### Requirement: OpenCode Session Runtime

The system MUST reconcile pending thread ids to final session ids deterministically when multiple engine pending threads coexist.

#### Scenario: dual pending threads coexist

- **GIVEN** workspace has both `claude-pending-*` and `opencode-pending-*` threads
- **WHEN** a `thread/started` event with real `sessionId` arrives
- **THEN** system resolves source pending thread deterministically by engine and activity signals
- **AND** renames exactly one pending thread to `<engine>:<sessionId>`
- **AND** MUST NOT rename the other engine pending thread
