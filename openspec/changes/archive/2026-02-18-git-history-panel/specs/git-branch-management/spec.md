# Git Branch Management Specification

## ADDED Requirements

### Requirement: Hierarchical Branch List

The system SHALL display local and remote branches in a grouped hierarchy.

#### Scenario: Local branches first

- **WHEN** panel opens
- **THEN** local branches are listed before remote branches

#### Scenario: Remote grouping

- **WHEN** remote branches are displayed
- **THEN** branches are grouped by remote name (for example `origin/*`, `upstream/*`)

#### Scenario: Current branch indicator

- **WHEN** list is rendered
- **THEN** current branch is highlighted with clear visual marker

---

### Requirement: Ahead/Behind Indicators

The system SHALL show ahead/behind status for tracking branches.

#### Scenario: Ahead

- **WHEN** local branch has unpushed commits
- **THEN** branch row displays `↑<count>`

#### Scenario: Behind

- **WHEN** local branch is behind remote
- **THEN** branch row displays `↓<count>`

#### Scenario: Diverged

- **WHEN** branch is both ahead and behind
- **THEN** branch row displays both indicators

---

### Requirement: Branch Checkout with Dirty-Tree Protection

The system SHALL support branch checkout with explicit handling for uncommitted changes.

#### Scenario: Clean checkout

- **WHEN** working tree is clean and user selects another branch
- **THEN** system executes checkout and updates current branch indicator

#### Scenario: Dirty checkout warning

- **WHEN** user attempts checkout with uncommitted changes
- **THEN** system shows options:
    - `Stash and Checkout`
    - `Discard and Checkout`
    - `Cancel`

#### Scenario: Checkout failure

- **WHEN** checkout fails
- **THEN** system shows user-friendly error and optional debug details

---

### Requirement: Create Branch from Current or Selected Commit

The system SHALL support branch creation from branch list or commit context menu.

#### Scenario: Create from current HEAD

- **WHEN** user chooses `New Branch` in branch list context
- **THEN** system prompts for branch name and creates a branch at HEAD

#### Scenario: Create from selected commit

- **WHEN** user chooses `Create Branch from Here` on commit row
- **THEN** system prompts for branch name and creates branch at selected commit

#### Scenario: Branch name validation

- **WHEN** user inputs an invalid branch name
- **THEN** system rejects the input using Git ref format rules and shows validation message

---

### Requirement: Branch Rename and Delete

The system SHALL support rename/delete for local branches with safety guards.

#### Scenario: Rename local branch

- **WHEN** user selects `Rename Branch`
- **THEN** system prompts for new name and updates branch list on success

#### Scenario: Prevent deleting current branch

- **WHEN** user tries to delete current branch
- **THEN** system blocks action and shows error

#### Scenario: Delete unmerged branch

- **WHEN** user deletes branch with unmerged commits
- **THEN** system shows warning confirmation before force delete

---

### Requirement: Branch Merge Action

The system SHALL support merging a selected branch into current branch.

#### Scenario: Merge success

- **WHEN** merge completes successfully
- **THEN** system refreshes history and shows success notification

#### Scenario: Merge conflict

- **WHEN** merge has conflicts
- **THEN** system shows conflict notification and guides user to conflict resolution workflow

---

### Requirement: Branch Context Menus

The system SHALL provide context actions based on branch type.

#### Scenario: Local branch menu

- **WHEN** user right-clicks a local branch
- **THEN** menu includes `Checkout`, `Create Branch from Here`, `Rename`, `Delete`, `Merge into Current`, `Copy Name`

#### Scenario: Remote branch menu

- **WHEN** user right-clicks a remote branch
- **THEN** menu includes `Checkout as Local`, `Fetch Remote`, `Copy Name`

---

### Requirement: Fetch Action in Branch Context

The system SHALL support fetching branch metadata without merge.

#### Scenario: Fetch all remotes

- **WHEN** user clicks `Fetch` in branch area toolbar
- **THEN** system executes fetch and refreshes remote branch state

#### Scenario: Fetch specific remote

- **WHEN** user triggers `Fetch` on a remote group
- **THEN** system fetches only that remote and updates affected branches
