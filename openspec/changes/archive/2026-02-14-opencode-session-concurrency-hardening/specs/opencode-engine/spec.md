# opencode-engine Specification Delta

## MODIFIED Requirements

### Requirement: OpenCode Engine Routing Determinism

OpenCode message routing MUST be determined by request-scoped engine context instead of mutable global UI state.

#### Scenario: engine switches during send

- **GIVEN** user triggers a send on an OpenCode-owned thread
- **AND** UI active engine changes before backend dispatch
- **WHEN** backend handles `engine_send_message`
- **THEN** routing MUST still follow request engine/thread engine
- **AND** MUST NOT be misrouted by global `active_engine` drift.

### Requirement: Pending Session Reconciliation Under Concurrency

Pending-to-session reconciliation MUST be deterministic under concurrent pending threads.

#### Scenario: two pending threads exist in same workspace

- **GIVEN** at least two pending threads are active concurrently
- **WHEN** a real session id event arrives
- **THEN** system MUST prefer strong evidence (`turnId`, `oldThreadId`, engine prefix)
- **AND** if ambiguity remains, system MUST NOT rename any pending thread until disambiguated.

### Requirement: OpenCode Isolation Guard

Concurrency hardening MUST remain OpenCode-scoped.

#### Scenario: shared hooks touched by hardening

- **GIVEN** shared thread hooks are used by Claude/Codex/OpenCode
- **WHEN** concurrency hardening logic executes
- **THEN** behavior changes MUST be gated to OpenCode
- **AND** Claude/Codex semantics MUST remain unchanged.
