# git-history-panel Specification Delta

## ADDED Requirements

### Requirement: Push Dialog Before Execution

The Git History toolbar SHALL open a push configuration dialog before executing push.

#### Scenario: Open push dialog

- **WHEN** user clicks toolbar `Push`
- **THEN** system SHALL open a push dialog
- **AND** system SHALL NOT execute push immediately

#### Scenario: Configure push target

- **WHEN** push dialog is open
- **THEN** dialog SHALL display current local branch as readonly value
- **AND** user SHALL be able to configure `remote` and `target remote branch`
- **AND** target remote branch SHALL support both dropdown selection and manual input
- **AND** dialog SHALL show target summary in `sourceBranch -> remote:targetBranch` form
- **AND** when `Push to Gerrit` is enabled, target summary SHALL switch to `sourceBranch -> remote:refs/for/targetBranch`

#### Scenario: Remote dropdown opens upward in push dialog

- **WHEN** user opens remote selector in push dialog
- **THEN** remote dropdown menu SHALL expand upward to avoid overlapping footer operation controls

#### Scenario: Show outgoing commits preview

- **WHEN** push dialog is open
- **THEN** system SHALL display `outgoing commits` list for current push target
- **AND** each list item SHALL include commit summary metadata (subject, sha, author, time)

#### Scenario: Preview panes keep fixed viewport with internal scrolling

- **WHEN** outgoing commit list or changed file list exceeds visible height
- **THEN** preview panes SHALL keep fixed height
- **AND** commit list and file list SHALL provide internal scrollbars instead of stretching dialog layout

#### Scenario: Target remote branch missing enters new-branch first-push mode

- **WHEN** preview result indicates target remote branch ref is missing (`targetFound=false`)
- **THEN** dialog SHALL show `New` marker in target summary area
- **AND** dialog SHALL keep preview section layout stable with first-push guidance placeholder
- **AND** dialog SHALL NOT render outgoing commit list items and selected commit detail content for that state

#### Scenario: Show selected commit file tree and details

- **WHEN** user selects a commit from outgoing list
- **THEN** system SHALL display changed files for that commit
- **AND** system SHALL display commit detail summary (message, sha, author, time)

#### Scenario: Open preview file diff by explicit file click

- **WHEN** selected commit details are visible in push preview
- **AND** user clicks one changed file row
- **THEN** system SHALL open a popup diff modal for that file
- **AND** selecting commit items alone SHALL NOT auto-open diff modal

#### Scenario: Refresh preview when push target changes

- **WHEN** user changes `remote` or `target remote branch`
- **THEN** system SHALL recompute outgoing commit preview
- **AND** list/detail panes SHALL update to new target context (or switch to new-branch first-push placeholder state
  when `targetFound=false`)

#### Scenario: Empty preview state blocks accidental push

- **WHEN** no outgoing commits exist for current push target
- **THEN** dialog SHALL show explicit empty state
- **AND** confirm push action SHALL be disabled

#### Scenario: Toggle Gerrit mode

- **WHEN** user enables `Push to Gerrit`
- **THEN** dialog SHALL reveal `Topic`, `Reviewers`, `CC` fields
- **AND** disabling Gerrit mode SHALL hide those fields

#### Scenario: Close dialog without side effects

- **WHEN** user cancels dialog or presses `Escape`
- **THEN** dialog closes
- **AND** no push command SHALL be sent
