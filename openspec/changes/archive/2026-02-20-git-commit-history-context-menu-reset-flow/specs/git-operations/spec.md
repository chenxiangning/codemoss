# git-operations Specification Delta

## ADDED Requirements

### Requirement: Reset Current Branch to Selected Commit

The system SHALL support resetting the current branch HEAD to a selected commit from commit history entry points.

#### Scenario: Open reset dialog

- **WHEN** user triggers `Reset Current Branch to Here...`
- **THEN** system SHALL open a confirmation dialog with branch name, target short hash, subject, and author
- **AND** dialog SHALL provide reset modes `soft`, `mixed`, `hard`, and `keep`
- **AND** default selected mode SHALL be `mixed`

#### Scenario: Confirm mixed reset

- **WHEN** user confirms reset with mode `mixed`
- **THEN** system SHALL move current branch HEAD to selected commit
- **AND** system SHALL reset index to target commit state
- **AND** system SHALL keep working tree file content

#### Scenario: Confirm hard reset

- **WHEN** user confirms reset with mode `hard`
- **THEN** system SHALL show destructive warning before execution
- **AND** on final confirm system SHALL reset HEAD, index, and working tree to target commit

#### Scenario: Confirm keep reset

- **WHEN** user confirms reset with mode `keep`
- **THEN** system SHALL attempt to move HEAD while preserving local modifications
- **AND** if preservation cannot be guaranteed system SHALL fail with readable guidance

#### Scenario: Reset failure feedback

- **WHEN** reset command fails
- **THEN** system SHALL show readable failure reason
- **AND** system SHALL provide retry entry without forcing panel reload

## MODIFIED Requirements

### Requirement: Operation Progress and Locking

The system SHALL provide clear progress state and avoid conflicting parallel writes.

#### Scenario: Disable conflicting actions

- **WHEN** one write operation is running in same workspace
- **THEN** pull/push/sync/cherry-pick/revert/reset buttons are disabled

#### Scenario: Progress state

- **WHEN** operation is in progress
- **THEN** toolbar shows spinner and status text
