## ADDED Requirements

### Requirement: Worktree Create Result Includes Persistent Warning and Retry Hint for Publish Failure

The system SHALL keep local create success visible when optional publish fails, and SHALL expose a persistent warning
with retry command hint.

#### Scenario: Local create succeeds but publish fails

- **WHEN** worktree branch creation succeeds and publish-to-origin fails
- **THEN** create result SHALL remain successful for local branch/worktree
- **AND** result payload SHALL include publish failure detail and retry command hint

#### Scenario: Warning remains visible until user closes or starts a new create attempt

- **WHEN** UI displays publish-failure warning after a successful local create
- **THEN** warning SHALL remain visible without fixed auto-dismiss timeout
- **AND** user SHALL be able to dismiss warning explicitly

### Requirement: Create Action Shows In-Progress Guard State

The system SHALL expose explicit `creating` state during worktree creation and block duplicate submission.

#### Scenario: Prevent duplicate create requests

- **WHEN** user clicks `Create` and request is in-flight
- **THEN** create action SHALL switch to in-progress state
- **AND** repeated create trigger SHALL be disabled until request finishes
