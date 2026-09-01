## ADDED Requirements

### Requirement: OMP ACP MUST Own Its Stdio Session Lifecycle

The system MUST implement OMP ACP over stdio as an OMP-owned transport covering initialize, session creation, prompt, updates, cancellation and terminal settlement.

#### Scenario: ACP session starts
- **WHEN** an OMP native session is requested
- **THEN** the client MUST initialize ACP and create the session before sending prompt content
- **AND** protocol errors MUST be surfaced as typed runtime errors

#### Scenario: ACP prompt streams
- **WHEN** OMP emits assistant or tool updates
- **THEN** the transport MUST preserve ordering and correlation ids
- **AND** MUST expose canonical events without leaking raw frames to the renderer

### Requirement: ACP Cancellation MUST Be Explicitly Settled

The system MUST distinguish cancel requested, cancel acknowledged and terminal cancellation.

#### Scenario: User cancels a running prompt
- **WHEN** cancellation is requested
- **THEN** the ACP client MUST send the protocol cancellation
- **AND** the turn MUST remain active until terminal cancellation or an explicit recovery outcome

### Requirement: ACP Transport MUST Enforce Frame And Process Limits

The transport MUST enforce bounded frame sizes, process exit handling and malformed-frame recovery.

#### Scenario: Malformed or oversized frame arrives
- **WHEN** a frame cannot be decoded or exceeds the configured limit
- **THEN** the current OMP turn MUST enter a recoverable error state
- **AND** the process MUST NOT be treated as successful completion
