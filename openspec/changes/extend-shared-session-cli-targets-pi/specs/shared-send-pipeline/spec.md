## RENAMED Requirements

- FROM: `### Requirement: Kimi Grok And OpenCode MUST Use The Shared V2 Durable Pipeline`
- TO: `### Requirement: Kimi Grok OpenCode And Pi MUST Use The Shared V2 Durable Pipeline`

## MODIFIED Requirements

### Requirement: Kimi Grok OpenCode And Pi MUST Use The Shared V2 Durable Pipeline

Kimi CLI、Grok CLI、OpenCode CLI and PI CLI Shared turns MUST use the existing attempt-owned
Shared V2 pipeline. They MUST NOT bypass Tx1、Context Package、Provider-scoped Binding、typed
dispatch receipt、Runtime settlement or canonical commit.

#### Scenario: durable intent precedes newly supported runtime

- **WHEN** a Shared turn targets Kimi、Grok、OpenCode or Pi
- **THEN** `conversation.turnRequested` with the full frozen snapshot MUST commit before the
  Native runtime is touched
- **AND** dispatch MUST consume the durable Attempt owner rather than current picker state

#### Scenario: EngineEvent settles the exact Attempt

- **WHEN** a newly supported CLI emits text、reasoning、tool and terminal EngineEvents
- **THEN** events MUST enter the Shared Runtime coordinator under the exact Provider runtime key
- **AND** terminal evidence MUST settle and commit the matching Attempt exactly once

#### Scenario: receipt mismatch fails closed

- **WHEN** runtime receipt Engine、Provider、Model、Reasoning or runtime key differs from the
  durable target snapshot
- **THEN** Shared dispatch MUST enter a visible failure or recovery state
- **AND** MUST NOT accept the Turn or silently route to a default target

#### Scenario: unverified import uses weak user-channel delivery

- **WHEN** Context Package is delivered to Kimi、Grok、OpenCode or Pi
- **THEN** the pipeline MUST use user-channel transcript delivery with weak ACK evidence
- **AND** MUST NOT claim structured history import or strong context ACK

#### Scenario: native event remains native without shared owner

- **WHEN** Kimi、Grok、OpenCode or Pi emits an EngineEvent without a registered Shared Attempt owner
- **THEN** the existing Native Session event payload and fan-out MUST remain unchanged
- **AND** no Shared canonical fact MUST be created

#### Scenario: established Pi binding resumes with session id

- **WHEN** a Pi Shared Binding already holds a native `pi:<sessionId>` identity
- **THEN** the next dispatch MUST strip the `pi:` prefix and pass `--session-id` continuation
- **AND** the CLI MUST NOT be started with the pending placeholder as a session id

### Requirement: Local Provider Runtime Key MUST Match Durable Attempt Identity

Every Shared-supported adapter MUST derive its local Provider Runtime key from the same canonical
helper used by the durable Attempt target snapshot. Kimi、Grok and Pi local launch profiles MUST
include the engine namespace, workspace identity, and canonical local Provider sentinel. Receipt
validation MUST remain strict.

#### Scenario: Kimi local receipt matches the durable Attempt

- **WHEN** a Shared turn dispatches through the Kimi local Provider
- **THEN** the adapter receipt Provider Runtime key MUST equal the durable Attempt Provider Runtime key
- **AND** the turn MUST NOT enter `recovery-required` because of a workspace-only key

#### Scenario: Grok local receipt matches the durable Attempt

- **WHEN** a Shared turn dispatches through the Grok local Provider
- **THEN** the adapter receipt Provider Runtime key MUST equal the durable Attempt Provider Runtime key
- **AND** the turn MUST NOT enter `recovery-required` because of a workspace-only key

#### Scenario: Pi local receipt matches the durable Attempt

- **WHEN** a Shared turn dispatches through the Pi local Provider
- **THEN** the adapter receipt Provider Runtime key MUST equal the durable Attempt Provider Runtime key
- **AND** the turn MUST NOT enter `recovery-required` because of a workspace-only key

#### Scenario: mismatched receipt still fails closed

- **WHEN** any adapter returns a Provider Runtime key that differs from the durable Attempt owner
- **THEN** Shared dispatch MUST continue to reject the receipt as ambiguous
- **AND** the system MUST NOT accept aliases or engine-only fallback keys
