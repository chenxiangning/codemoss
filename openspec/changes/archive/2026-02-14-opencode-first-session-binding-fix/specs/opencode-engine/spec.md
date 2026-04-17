## MODIFIED Requirements

### Requirement: Pending Session Reconciliation Under Concurrency

Pending-to-session reconciliation MUST remain deterministic even when threadId prefix is missing on first local send.

#### Scenario: first OpenCode send from non-prefixed local thread id

- **GIVEN** current thread is marked as OpenCode engine but id is not `opencode:*` or `opencode-pending-*`
- **WHEN** user sends first message
- **THEN** frontend MUST create a fresh `opencode-pending-*` thread before dispatching send
- **AND** subsequent `thread/started` reconciliation MUST bind to that pending thread.

### Requirement: OpenCode Engine Routing Determinism

`thread/started` events for local CLI engines MUST include engine identity for frontend reconciliation.

#### Scenario: thread started carries engine hint

- **GIVEN** backend emits `thread/started` after session id is known
- **WHEN** frontend receives event with non-prefixed source thread id
- **THEN** frontend MUST use event engine hint to compute destination thread id `<engine>:<sessionId>`
- **AND** MUST avoid cross-engine fallback guessing.

### Requirement: OpenCode Non-Streaming UX Hint

OpenCode UI MUST provide a clear waiting hint when a selected model returns delayed single-chunk output.

#### Scenario: long first-chunk wait under opencode

- **GIVEN** current engine is `opencode`
- **AND** a turn is in processing state without assistant chunk after the latest user message
- **WHEN** wait duration exceeds a short threshold
- **THEN** UI MUST show a non-streaming hint to the user
- **AND** this hint MUST NOT appear on non-OpenCode engines.

### Requirement: Non-Streaming Hint Must Never Leak Raw I18n Key

When localization lookup fails at runtime, the hint text MUST still render readable fallback copy instead of raw key
path.

#### Scenario: i18n key lookup misses for non-streaming hint

- **GIVEN** `messages.nonStreamingHint` cannot be resolved in current i18n runtime context
- **WHEN** OpenCode slow-first-chunk hint is displayed
- **THEN** UI MUST render a readable default sentence
- **AND** MUST NOT render literal key text such as `messages.nonStreamingHint`.

### Requirement: Provider/Model State Presentation Consistency

OpenCode provider health and panel display MUST keep consistent semantics when model/provider cannot be directly
inferred.

#### Scenario: model/provider unresolved but credentials exist

- **GIVEN** current selected model cannot infer provider directly
- **AND** `opencode auth list` contains authenticated providers
- **WHEN** backend builds provider health and frontend renders onboarding/panel
- **THEN** backend MUST avoid contradictory state (`provider=unknown` with matched=true)
- **AND** frontend MUST filter placeholder values (`unknown`, `-`) from Provider/Model primary display.

### Requirement: Reachability Must Be Checked Before OpenCode Send

For providers with known endpoints, OpenCode send path MUST perform a short network reachability preflight to avoid long
misleading waiting time.

#### Scenario: openai model selected but endpoint unreachable

- **GIVEN** selected model resolves to OpenAI provider
- **WHEN** user sends a message in OpenCode
- **THEN** backend MUST run a short endpoint reachability preflight before invoking long-running CLI turn
- **AND** if preflight fails, turn MUST fail fast with explicit network-unreachable message.

### Requirement: Auth Status and Reachability Semantics Must Be Separated

OpenCode UI status text MUST NOT imply endpoint reachability from authentication state alone.

#### Scenario: credentials exist but network path is blocked

- **GIVEN** provider credentials are present
- **AND** endpoint is unreachable
- **WHEN** panel renders top-level status
- **THEN** status text MUST indicate auth readiness (e.g., `Auth Ready`) rather than endpoint connected
- **AND** waiting hint copy SHOULD mention both non-streaming and possible network issues.
