## ADDED Requirements

### Requirement: Shared history open MUST become interactive after V0 snapshot

When opening a Shared thread (`shared:*`), the system MUST treat a successful V0 session snapshot (`load_shared_session` / equivalent) as sufficient for first-paint readiness. The system MUST NOT keep the conversation history loading gate (`historyLoading === true` or equivalent full-canvas curtain) waiting solely for canonical projection to finish.

#### Scenario: V0 snapshot unblocks history loading gate

- **GIVEN** a Shared thread with a non-empty or empty V0 snapshot response that returns successfully
- **WHEN** the history open path finishes loading the V0 snapshot
- **THEN** the system MUST hydrate the canvas from that snapshot (via the shared assembler entrypoint)
- **AND** MUST clear the blocking history-loading gate for that thread so the user can continue interacting
- **AND** MUST NOT require `load_shared_projection` success before clearing that gate

#### Scenario: Projection still runs after V0 readiness

- **GIVEN** Shared projection data source is enabled
- **WHEN** V0 readiness has already been reached
- **THEN** the system MAY continue fetching and merging canonical projection in the background
- **AND** a later successful projection MUST merge into the canvas without requiring a full page re-lock on history loading

### Requirement: Shared projection wait MUST time out with V0-preserving degradation

The Shared history open path MUST bound how long it waits on `load_shared_projection` for user-visible blocking behavior. When a V0 snapshot is already available, projection timeout or failure MUST preserve the V0 canvas rather than leaving the UI hung on the projection phase indefinitely.

#### Scenario: Projection timeout keeps V0 canvas

- **GIVEN** V0 snapshot was applied and history loading gate was cleared
- **AND** projection does not complete within the configured soft timeout
- **THEN** the system MUST stop waiting for that projection attempt for UI readiness purposes
- **AND** MUST keep the V0-hydrated items on the canvas
- **AND** MUST record an observable warning or silent diagnostic (no user-operated switch required)

#### Scenario: Projection failure with no V0 snapshot still fails closed

- **GIVEN** V0 snapshot is unavailable or empty such that history cannot be preserved
- **AND** projection fails
- **THEN** the system MUST surface history load failure according to existing fail-closed rules
- **AND** MUST NOT silently invent conversation items

### Requirement: In-flight projection MUST NOT block send when recovery is clear

While Shared history projection is still in progress or timed out after V0 readiness, the send pipeline gate MUST depend on Shared send/recovery state (and target availability), not on projection completion.

#### Scenario: User can send after V0 ready without recovery lock

- **GIVEN** Shared send state is idle (not `recovery-required`)
- **AND** V0 history readiness has been reached
- **AND** projection is still running or was timed out
- **WHEN** the user submits a new turn
- **THEN** the system MUST allow the send path to proceed under existing Shared V2 contracts
- **AND** MUST NOT disable send solely because projection has not finished

#### Scenario: Recovery lock still blocks send

- **GIVEN** Shared send state is `recovery-required`
- **WHEN** the user attempts to send
- **THEN** send MUST remain blocked by recovery rules regardless of history projection phase
