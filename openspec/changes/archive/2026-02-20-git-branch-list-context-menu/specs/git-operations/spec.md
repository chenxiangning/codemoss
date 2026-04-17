# git-operations Specification Delta

## ADDED Requirements

### Requirement: Update Operation from Branch Context Menu

The system SHALL provide `更新 (Update)` action in branch context menu and execute the same update semantics as existing
Git update workflow.

#### Scenario: Update current branch from context menu

- **WHEN** user triggers `更新 (Update)` on current local branch
- **THEN** system SHALL execute update workflow for the active branch
- **AND** system SHALL show in-progress and completion feedback

#### Scenario: Update unavailable branch state

- **WHEN** selected branch has no valid update path (for example no tracking configuration)
- **THEN** system SHALL disable `更新 (Update)` action
- **AND** system SHALL provide readable reason hint

#### Scenario: Update failure feedback

- **WHEN** update execution fails
- **THEN** system SHALL show user-facing failure reason
- **AND** system SHALL keep retry entry available when error is retryable

### Requirement: Branch Comparison Query

The system SHALL provide directional commit-set queries for branch-to-branch comparison (IDEA-style compare workspace).

#### Scenario: Query target-only commits

- **WHEN** compare action is triggered with `target` and `current`
- **THEN** system SHALL return commits reachable from `target` but not from `current`
- **AND** each entry SHALL include commit identity and basic metadata needed for list rendering

#### Scenario: Query current-only commits

- **WHEN** compare action is triggered with `target` and `current`
- **THEN** system SHALL return commits reachable from `current` but not from `target`
- **AND** each entry SHALL include commit identity and basic metadata needed for list rendering

#### Scenario: Query selected commit details

- **WHEN** user selects a commit in either direction list
- **THEN** system SHALL return detail payload for that commit (summary + changed files + per-file diff preview data)
- **AND** detail loading SHALL be independent from the other direction list

## MODIFIED Requirements

### Requirement: Push Operation

The system SHALL allow pushing local commits from both toolbar and branch context menu.

#### Scenario: Execute push

- **WHEN** user clicks `Push` in toolbar or triggers `推送... (Push)` from branch context menu on a local branch
- **THEN** system SHALL execute push for selected local branch

#### Scenario: Push rejected

- **WHEN** push is non-fast-forward rejected
- **THEN** system SHALL show `Push rejected` error
- **AND** system SHALL recommend pull or rebase workflow

#### Scenario: Force push confirmation

- **WHEN** user triggers force push
- **THEN** system MUST show destructive confirmation dialog before execution
