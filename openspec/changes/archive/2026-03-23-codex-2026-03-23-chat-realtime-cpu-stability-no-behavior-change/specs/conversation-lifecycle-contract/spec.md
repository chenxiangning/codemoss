## ADDED Requirements

### Requirement: Realtime Optimization Must Preserve Lifecycle Semantics

Any client-side realtime CPU optimization MUST preserve conversation lifecycle semantics and terminal outcomes.

#### Scenario: optimized and baseline paths converge to same lifecycle outcome
- **WHEN** the same ordered event stream is replayed through baseline and optimized paths
- **THEN** both paths MUST converge to the same lifecycle state transitions and terminal state
- **AND** user-visible message continuity MUST remain equivalent

#### Scenario: batching does not leave pseudo-processing residue
- **WHEN** a turn reaches completed or error terminal state under optimized processing
- **THEN** lifecycle state MUST leave processing mode deterministically
- **AND** the thread MUST NOT remain in stuck pseudo-processing state

### Requirement: Cross-Engine Lifecycle Parity Under Optimization

Realtime optimization MUST NOT introduce engine-specific lifecycle regressions for Codex, Claude, or OpenCode.

#### Scenario: optimization keeps lifecycle parity across engines
- **WHEN** equivalent lifecycle events are processed for Codex, Claude, and OpenCode threads
- **THEN** lifecycle semantics MUST remain consistent with existing engine contracts
- **AND** optimization internals MUST NOT leak engine-specific behavior to users

#### Scenario: rollback path keeps lifecycle contract intact
- **WHEN** optimization modules are partially or fully disabled for rollback
- **THEN** lifecycle handling MUST still satisfy existing conversation lifecycle requirements
- **AND** restart/replay lifecycle continuity MUST remain valid
