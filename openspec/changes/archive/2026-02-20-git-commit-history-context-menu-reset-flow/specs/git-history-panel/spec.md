# git-history-panel Specification Delta

## ADDED Requirements

### Requirement: Commit Action Button Group

The commit history workspace SHALL provide a linked commit action button group that mirrors key commit-row context
actions.

#### Scenario: Button group actions

- **WHEN** Git History panel is open and a commit is selected
- **THEN** commit action button group SHALL expose:
    - `Copy Revision Number`
    - `Create Branch from Commit`
    - `Reset Current Branch to Here...`

#### Scenario: Selection-driven availability

- **WHEN** no commit is selected
- **THEN** commit action button group SHALL be disabled
- **AND** no action SHALL execute

#### Scenario: Shared availability with context menu

- **WHEN** repository enters busy write-operation state
- **THEN** `Reset Current Branch to Here...` SHALL be disabled in button group
- **AND** the same action SHALL be disabled in commit-row context menu
