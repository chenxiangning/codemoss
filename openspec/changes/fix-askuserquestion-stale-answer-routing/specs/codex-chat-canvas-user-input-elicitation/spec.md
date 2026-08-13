## MODIFIED Requirements

### Requirement: Timed-Out User Input Settlement Releases Stale Cards

The system MUST treat a user action against a locally timed-out `AskUserQuestion` / `RequestUserInput` card as stale settlement when runtime reports that the request is no longer actionable.

#### Scenario: timed-out submit returns stale runtime error
- **WHEN** a visible user-input card has reached `0:00`
- **AND** the user clicks Submit with selected answers
- **AND** runtime response indicates the request is unknown, stale, timeout-settled, cancelled, or workspace disconnected
- **THEN** the client MUST remove the request from the pending queue
- **AND** the client MUST clear optimistic processing residue for that thread
- **AND** the client MUST NOT show the stale response as a fatal submit failure
- **AND** the client MUST NOT insert a submitted-answer history item for the stale response

#### Scenario: timed-out skip returns stale runtime error
- **WHEN** a visible or collapsed user-input card has reached `0:00`
- **AND** the user clicks Skip / dismiss
- **AND** runtime response indicates the request is unknown, stale, timeout-settled, cancelled, or workspace disconnected
- **THEN** the client MUST remove the request from the pending queue
- **AND** the client MUST NOT show the stale response as a fatal submit failure

#### Scenario: ordinary submit failure remains retryable
- **WHEN** the user submits a user-input card
- **AND** runtime response fails without stale / timeout settlement evidence
- **THEN** the client MUST keep the request visible
- **AND** the user MUST be able to retry submission

#### Scenario: a late Claude AskUserQuestion answer is recognized as expired independent of local timing
- **WHEN** a user submits or skips a Claude-origin `AskUserQuestion` card
- **AND** the backend has already resolved that request (timeout, prior answer, or turn teardown)
  so no Claude session has it pending anymore
- **AND** the workspace still has at least one live Claude session
- **THEN** the backend response MUST be distinguishable from a generic workspace-connectivity
  failure
- **AND** the backend MUST NOT route the lookup through Codex-session resolution for a
  Claude-origin request id

  Note: the precondition is deliberate. When a workspace has no live Claude session at all, a
  generic connectivity failure is the honest answer, and Codex-only workspaces MUST keep their
  existing routing untouched.
- **AND** the client MUST classify the response as stale settlement regardless of whether a local
  timeout hint was attached to the request

## ADDED Requirements

### Requirement: AskUserQuestion Local Countdown MUST Reflect Actual Elapsed Time

The visible remaining-time countdown for a pending `AskUserQuestion` / `RequestUserInput` card MUST be derived from actual elapsed wall-clock time, not from an accumulated per-tick counter that can lag behind real time when the UI's timer scheduling is delayed or throttled.

#### Scenario: countdown reflects a system clock jump without a timer tick

- **WHEN** a user-input card is pending
- **AND** wall-clock time advances past the card's timeout window without any timer callback
  having fired (e.g. a backgrounded or minimized window)
- **THEN** the next read of the remaining time MUST reflect the actual elapsed time
- **AND** a manual submit made at that point MUST be treated as a timed-out settlement

#### Scenario: countdown display keeps updating after a failed submit

- **WHEN** a submit attempt for a pending user-input card fails
- **THEN** the visible countdown MUST continue to reflect actual elapsed time
- **AND** the countdown display MUST NOT freeze at the value it held when the submit failed
