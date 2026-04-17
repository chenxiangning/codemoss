# codex-context-auto-compaction Specification

## Purpose
TBD - created by archiving change codex-context-auto-compaction-runtime. Update Purpose after archive.
## Requirements
### Requirement: Codex Auto Compaction Trigger
The system MUST automatically trigger context compaction for Codex threads when context usage reaches the configured high-watermark.

#### Scenario: Trigger compaction when threshold exceeded
- **WHEN** a Codex thread reports token usage percent greater than or equal to the compaction threshold
- **AND** the thread is not processing a user turn
- **THEN** the runtime SHALL start auto compaction for that thread

#### Scenario: Do not trigger below threshold
- **WHEN** a Codex thread reports token usage percent lower than the compaction threshold
- **THEN** the runtime SHALL NOT start auto compaction

### Requirement: Codex-Only Compaction Scope
Auto compaction logic MUST be limited to Codex runtime sessions.

#### Scenario: Non-codex engines are unaffected
- **WHEN** a thread belongs to non-codex engines
- **THEN** auto compaction scheduling SHALL NOT execute for that thread
- **AND** existing thread behavior SHALL remain unchanged

### Requirement: Compaction Idempotency and Cooldown
The runtime MUST prevent duplicate or storm-style compaction requests for the same thread.

#### Scenario: Prevent duplicate while in-flight
- **WHEN** a thread already has an in-flight compaction request
- **THEN** the runtime SHALL NOT send another compaction request for that thread

#### Scenario: Respect cooldown window
- **WHEN** a thread has triggered auto compaction within the configured cooldown interval
- **THEN** the runtime SHALL NOT trigger another compaction request until cooldown expires

### Requirement: Failure-safe Behavior
Compaction failures MUST not block normal conversation flow.

#### Scenario: Compaction request fails
- **WHEN** runtime fails to start compaction for a thread
- **THEN** the thread SHALL remain available for normal send/receive turns
- **AND** runtime SHALL record failure diagnostics for observability

