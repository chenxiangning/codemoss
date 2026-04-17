# git-commit-history Specification Delta

## MODIFIED Requirements

### Requirement: Commit Context Menu Actions

The commit row context menu SHALL expose grouped history actions with deterministic order, and SHALL include the
priority actions `Copy Revision Number` and `Reset Current Branch to Here`.

#### Scenario: Open context menu

- **WHEN** user right-clicks a commit row
- **THEN** menu SHALL include grouped actions in fixed order:
    - `Quick`: `Copy Revision Number`, `Copy Commit Message`
    - `Branch`: `Create Branch from Here`, `Reset Current Branch to Here...`
    - `Write`: `Cherry-Pick`, `Revert Commit`

#### Scenario: Copy revision number

- **WHEN** user clicks `Copy Revision Number`
- **THEN** full selected commit hash SHALL be copied to clipboard
- **AND** system SHALL provide success feedback

#### Scenario: Reset action is confirmation-first

- **WHEN** user clicks `Reset Current Branch to Here...`
- **THEN** system SHALL open reset confirmation dialog
- **AND** system SHALL NOT execute git reset before explicit confirm

#### Scenario: Context menu and action button group stay consistent

- **WHEN** selected commit or repository operation state changes
- **THEN** context menu action availability SHALL match the linked commit action button group
- **AND** disabled reason text SHALL remain consistent between both entry points
