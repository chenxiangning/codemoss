# opencode-engine Specification Delta

## MODIFIED Requirements

### Requirement: OpenCode Model Safety

OpenCode message sending MUST enforce model-engine compatibility and avoid cross-engine model passthrough.

#### Scenario: invalid claude model on opencode send

- **GIVEN** active thread engine resolves to `opencode`
- **AND** selected model id is `claude-*`
- **WHEN** user sends a message
- **THEN** system MUST NOT forward `claude-*` to OpenCode CLI
- **AND** system MUST fallback to a valid OpenCode model id.

### Requirement: OpenCode Chat Responsiveness

The OpenCode chat path MUST avoid expensive provider/session discovery calls in the critical send path.

#### Scenario: composer sends while panel visible

- **GIVEN** OpenCode control panel is visible
- **WHEN** user sends a new message
- **THEN** panel refresh routines MUST be throttled or deferred
- **AND** send flow MUST start without waiting on catalog/health/session background queries.

### Requirement: OpenCode Session List Integrity

Thread list rendering MUST include OpenCode historical sessions consistently.

#### Scenario: workspace reload

- **GIVEN** workspace has OpenCode sessions in CLI session list
- **WHEN** frontend reloads thread list
- **THEN** OpenCode sessions MUST appear in thread list with stable `opencode:<sessionId>` ids.

### Requirement: Pending Session Reconciliation

Pending-to-session reconciliation MUST be deterministic and turn-aware to prevent UI jump.

#### Scenario: pending session receives real session id under concurrent events

- **GIVEN** a pending OpenCode thread with active turn binding
- **WHEN** `thread/started` arrives with real session id
- **THEN** system MUST reconcile using turn binding first
- **AND** MUST keep message stream attached to the reconciled thread id.

### Requirement: Engine Isolation Guard

OpenCode chat optimizations MUST remain isolated and MUST NOT alter Claude/Codex behavioral semantics.

#### Scenario: shared hooks with engine-specific optimization

- **GIVEN** shared frontend hooks are used by multiple engines
- **WHEN** adding OpenCode reliability/performance logic
- **THEN** new behavior MUST be gated by `engine === "opencode"`
- **AND** Claude/Codex paths MUST keep previous behavior.

### Requirement: OpenCode First Token Latency Protection

OpenCode queue processing MUST avoid indefinite in-flight stuck state when turn-start events are delayed or missing.

#### Scenario: queued message fails to enter processing state

- **GIVEN** OpenCode queued message is dequeued
- **WHEN** processing state does not transition in expected window
- **THEN** in-flight marker MUST be safely released for retry
- **AND** behavior MUST be limited to OpenCode threads.

### Requirement: OpenCode Terminal Completion Robustness

OpenCode turn lifecycle MUST complete promptly even when CLI omits terminal events for short replies.

#### Scenario: response text exists but no explicit turn_complete event

- **GIVEN** OpenCode has emitted assistant text deltas
- **AND** there are no active tool calls
- **WHEN** stream stays idle past a short post-response grace window
- **THEN** backend MUST close the turn as completed (OpenCode-only)
- **AND** MUST NOT block until the global 120s idle timeout.
