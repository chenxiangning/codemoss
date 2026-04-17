## ADDED Requirements

### Requirement: Non-Interactive Execution and Timeout Guard for Network Git Commands

The system SHALL execute `pull`, `sync`, and `fetch` with non-interactive command environment and bounded timeout to
prevent hidden credential prompts from blocking indefinitely.

#### Scenario: Pull runs with bounded timeout

- **WHEN** user confirms `Pull`
- **THEN** backend SHALL run pull in non-interactive mode
- **AND** backend SHALL fail the command when timeout threshold is reached

#### Scenario: Sync and fetch run with bounded timeout

- **WHEN** user confirms `Sync` or `Fetch`
- **THEN** backend SHALL run the network Git command in non-interactive mode
- **AND** backend SHALL fail the command when timeout threshold is reached

#### Scenario: Timeout failure is actionable

- **WHEN** command fails due to timeout or authentication interaction requirement
- **THEN** system SHALL return stable error type for i18n mapping
- **AND** UI SHALL show retry guidance instead of generic unknown error

### Requirement: Workspace Lock Release Before Long-Running Network Git Commands

The system SHALL release workspace-level lock before launching long-running network Git operations to reduce lock
contention.

#### Scenario: Pull/sync/fetch avoids lock amplification

- **WHEN** backend is about to execute long-running `pull`, `sync`, or `fetch`
- **THEN** workspace lock SHALL NOT be held for the full external command lifetime
- **AND** subsequent operations SHALL observe reduced blocked-wait time compared with holding lock throughout
