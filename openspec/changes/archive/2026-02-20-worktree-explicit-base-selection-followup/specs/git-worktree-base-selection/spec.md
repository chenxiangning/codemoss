## ADDED Requirements

### Requirement: Worktree Create Errors Must Be User-Readable and Actionable

The system SHALL map core worktree-create failures to stable, user-readable messages with actionable hints.

#### Scenario: Base reference is invalid

- **WHEN** create request fails due to invalid or unresolvable `baseRef`
- **THEN** system SHALL show a dedicated validation message for base branch selection
- **AND** system SHALL NOT show raw low-level error as primary message

#### Scenario: Target path conflicts

- **WHEN** create request fails because target worktree path already conflicts
- **THEN** system SHALL show a dedicated path-conflict message
- **AND** system SHALL provide a clear next step (change branch name or target folder)

#### Scenario: Branch name is invalid

- **WHEN** create request fails due to branch naming rule violations
- **THEN** system SHALL show a dedicated branch-name validation message
- **AND** system SHALL keep user input for correction

---

### Requirement: Publish Result Must Distinguish Local Success and Remote Failure

The system SHALL explicitly separate local worktree creation result from remote publish result.

#### Scenario: Local success and remote success

- **WHEN** local worktree creation succeeds and `publishToOrigin` also succeeds
- **THEN** system SHALL show remote tracking result (for example `origin/<branch>`)
- **AND** system SHALL mark status as fully completed

#### Scenario: Local success and remote failure

- **WHEN** local worktree creation succeeds but publish fails
- **THEN** system SHALL keep local worktree as successful
- **AND** system SHALL show remote publish failure reason and retry command hint

---

### Requirement: Unavailable Session Engine Entry Must Be Explicitly Disabled

The system SHALL keep unavailable engine entries discoverable but explicitly disabled with reason.

#### Scenario: Gemini is not yet available

- **WHEN** user opens workspace `+` action menu
- **THEN** system SHALL render `Gemini` as disabled
- **AND** system SHALL show an availability hint such as `(未开放)` / `(Unavailable)`
