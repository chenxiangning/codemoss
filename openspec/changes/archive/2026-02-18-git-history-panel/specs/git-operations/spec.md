# Git Operations Specification

## ADDED Requirements

### Requirement: Pull Operation

The system SHALL allow pulling remote changes for current branch.

#### Scenario: Execute pull

- **WHEN** user clicks `Pull`
- **THEN** system executes pull and shows in-progress state

#### Scenario: Pull success

- **WHEN** pull succeeds
- **THEN** system shows success notification and refreshes history + branch indicators

#### Scenario: Pull conflict

- **WHEN** pull produces conflicts
- **THEN** system shows conflict error and keeps operation in failed state with retry guidance

---

### Requirement: Push Operation

The system SHALL allow pushing local commits.

#### Scenario: Execute push

- **WHEN** user clicks `Push`
- **THEN** system executes push for current branch

#### Scenario: Push rejected

- **WHEN** push is non-fast-forward rejected
- **THEN** system shows `Push rejected` error and recommends pull/rebase workflow

#### Scenario: Force push confirmation

- **WHEN** user triggers force push
- **THEN** system MUST show destructive confirmation dialog before execution

---

### Requirement: Sync and Fetch Operations

The system SHALL provide `Sync` and `Fetch` actions.

#### Scenario: Sync action

- **WHEN** user clicks `Sync`
- **THEN** system performs pull then conditional push and reports final status

#### Scenario: Fetch action

- **WHEN** user clicks `Fetch`
- **THEN** system fetches remotes without merge and refreshes ahead/behind indicators

---

### Requirement: Cherry-Pick and Revert

The system SHALL support commit-level write actions from history context.

#### Scenario: Cherry-pick commit

- **WHEN** user executes `Cherry-Pick` on commit
- **THEN** system runs cherry-pick and refreshes history on success

#### Scenario: Revert commit confirmation

- **WHEN** user executes `Revert Commit`
- **THEN** system asks confirmation before creating revert commit

#### Scenario: Action conflict

- **WHEN** cherry-pick or revert causes conflict
- **THEN** system shows conflict error with next-step guidance

---

### Requirement: Operation Progress and Locking

The system SHALL provide clear progress state and avoid conflicting parallel writes.

#### Scenario: Disable conflicting actions

- **WHEN** one write operation is running in same workspace
- **THEN** pull/push/sync/cherry-pick/revert buttons are disabled

#### Scenario: Progress state

- **WHEN** operation is in progress
- **THEN** toolbar shows spinner and status text

---

### Requirement: Retry and Error Detail

The system SHALL support retry and controlled error details.

#### Scenario: Retry failed action

- **WHEN** operation fails and is retryable
- **THEN** notification offers `Retry`

#### Scenario: Copy error details

- **WHEN** user clicks `Copy Details`
- **THEN** system copies sanitized debug message

---

### Requirement: Cancellation Semantics

The system SHALL support cancellation at request level for long-running operations.

#### Scenario: Cancel in-progress request

- **WHEN** user clicks `Cancel` in operation status
- **THEN** UI stops waiting and marks request cancelled

#### Scenario: Ignore stale completion

- **WHEN** a cancelled request completes later in backend
- **THEN** stale response SHALL NOT override latest UI state

---

### Requirement: Keyboard Shortcuts

The system SHALL provide optional shortcuts for core operations.

#### Scenario: Pull shortcut

- **WHEN** user presses `Cmd/Ctrl + Shift + P` and panel focus is active
- **THEN** pull operation is triggered

#### Scenario: Push shortcut

- **WHEN** user presses `Cmd/Ctrl + Shift + U` and panel focus is active
- **THEN** push operation is triggered

#### Scenario: Sync shortcut

- **WHEN** user presses `Cmd/Ctrl + Shift + S` and panel focus is active
- **THEN** sync operation is triggered

#### Scenario: Fetch shortcut

- **WHEN** user presses `Cmd/Ctrl + Shift + F` and panel focus is active
- **THEN** fetch operation is triggered
