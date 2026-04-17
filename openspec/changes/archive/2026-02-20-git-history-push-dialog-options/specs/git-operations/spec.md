# git-operations Specification Delta

## MODIFIED Requirements

### Requirement: Push Operation

The system SHALL allow pushing local commits from toolbar and branch context menu, and toolbar push SHALL be
confirmation-first with configurable options.

#### Scenario: Execute push from toolbar

- **WHEN** user clicks `Push` in toolbar and confirms in push dialog
- **THEN** system SHALL execute push using configured options

#### Scenario: Push options mapping

- **WHEN** user confirms push dialog
- **THEN** system SHALL map selected options to push execution:
    - `remote`
    - `target remote branch`
    - `pushTags`
    - `runHooks`
    - `forceWithLease`
    - `pushToGerrit`
    - `topic/reviewers/cc` (when Gerrit enabled)

#### Scenario: Query outgoing commits for push preview

- **WHEN** push dialog requests preview with `source branch` and target `remote:branch`
- **THEN** system SHALL return commits reachable from source branch HEAD and not yet contained in target ref
- **AND** each entry SHALL include fields required for list rendering (sha, summary, author, time)

#### Scenario: Target ref missing indicator for first push

- **WHEN** target `remote:branch` cannot be resolved in local remote refs
- **THEN** preview response SHALL set `targetFound=false`
- **AND** client MAY switch to new-branch first-push presentation mode based on this flag

#### Scenario: Query selected outgoing commit details

- **WHEN** user selects a commit in push preview
- **THEN** system SHALL provide commit detail payload (message + changed files + file-level diff summary)
- **AND** this query SHALL be independent from push execution itself

#### Scenario: Gerrit push refspec

- **WHEN** `pushToGerrit` is enabled
- **THEN** system SHALL push to `refs/for/<branch>`
- **AND** optional `topic/reviewers/cc` SHALL be appended as Gerrit push options

#### Scenario: Backward compatibility

- **WHEN** push is triggered without explicit options
- **THEN** system SHALL preserve existing default push behavior

#### Scenario: Push rejected

- **WHEN** push is non-fast-forward rejected
- **THEN** system SHALL show `Push rejected` error
- **AND** system SHALL recommend pull or rebase workflow
