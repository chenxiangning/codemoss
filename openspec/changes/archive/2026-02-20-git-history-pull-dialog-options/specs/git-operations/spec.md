# git-operations Specification Delta

## MODIFIED Requirements

### Requirement: Pull Operation

The system SHALL allow pulling remote changes from toolbar, and toolbar pull SHALL be confirmation-first with
configurable options.

#### Scenario: Execute pull from toolbar

- **WHEN** user clicks `Pull` in toolbar and confirms in pull dialog
- **THEN** system SHALL execute pull using configured options

#### Scenario: Pull options mapping

- **WHEN** user confirms pull dialog
- **THEN** system SHALL map selected options to pull execution:
    - `remote`
    - `target remote branch`
    - strategy option (`--rebase` or `--ff-only` or `--no-ff` or `--squash`)
    - additive options (`--no-commit`, `--no-verify`)

#### Scenario: Strategy option conflict guard

- **WHEN** pull request payload includes more than one strategy option
- **THEN** system SHALL reject request before Git execution
- **AND** system SHALL return readable validation error

#### Scenario: Backward compatibility

- **WHEN** pull is triggered without explicit options
- **THEN** system SHALL preserve existing default pull behavior

#### Scenario: Pull success

- **WHEN** pull succeeds
- **THEN** system SHALL show success notification
- **AND** system SHALL refresh history and branch indicators

#### Scenario: Pull conflict

- **WHEN** pull produces conflicts
- **THEN** system SHALL show conflict error
- **AND** system SHALL keep operation in failed state with retry guidance

### Requirement: Sync and Fetch Operations

The system SHALL provide `Sync` and `Fetch` actions, and both actions SHALL be confirmation-first from toolbar.

#### Scenario: Execute sync from toolbar

- **WHEN** user clicks `Sync` and confirms in sync dialog
- **THEN** system performs pull then conditional push and reports final status

#### Scenario: Sync intent semantics

- **WHEN** sync dialog is open
- **THEN** system SHALL describe sync as `pull -> push` combined workflow
- **AND** system SHALL not execute either step until user confirms

#### Scenario: Execute fetch from toolbar

- **WHEN** user clicks `Fetch` and confirms in fetch dialog
- **THEN** system fetches remotes without merge and refreshes ahead/behind indicators

#### Scenario: Fetch intent semantics

- **WHEN** fetch dialog is open
- **THEN** system SHALL describe fetch as remote reference update without merge
- **AND** system SHALL not execute fetch until user confirms

#### Scenario: Fetch scope default

- **WHEN** user confirms fetch dialog without custom scope override
- **THEN** system SHALL execute fetch with default scope `all remotes`
