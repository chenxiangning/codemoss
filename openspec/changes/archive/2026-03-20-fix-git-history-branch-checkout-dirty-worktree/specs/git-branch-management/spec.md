# git-branch-management Specification Delta

## MODIFIED Requirements

### Requirement: Branch Checkout with Dirty-Tree Protection

The system SHALL support branch checkout with explicit handling for uncommitted changes and SHALL guarantee deterministic
clean-state results after successful checkout from a clean workspace.

#### Scenario: Clean checkout keeps repository clean

- **WHEN** working tree is clean and user selects another branch
- **THEN** system SHALL execute checkout and update current branch indicator
- **AND** post-checkout `git status` SHALL contain no staged or unstaged entries

#### Scenario: Dirty checkout is blocked with guidance

- **WHEN** user attempts checkout with uncommitted changes
- **THEN** system SHALL block checkout before switching current branch indicator
- **AND** system SHALL show explicit guidance to commit/stash/discard changes first
- **AND** system SHALL NOT report operation success

#### Scenario: Checkout failure is not reported as success

- **WHEN** checkout fails
- **THEN** system SHALL show user-friendly error and optional debug details
- **AND** current branch indicator SHALL remain source branch
- **AND** system SHALL NOT report operation success

#### Scenario: Branch switching does not accumulate residual diffs

- **WHEN** user repeatedly switches between two clean branches with divergent file sets
- **THEN** every successful checkout SHALL end with a clean working tree
- **AND** system SHALL NOT leave residual staged or unstaged entries from the previous branch
