# Spec: Git Panel Diff View (Flat/Tree + Single File Focus)

## ADDED Requirements

### Requirement: Dual List View Modes

The Git panel SHALL support two file-list view modes: `flat` and `tree`.

#### Scenario: Default mode remains flat

- **WHEN** user opens Git panel for a workspace without saved preference
- **THEN** panel SHALL render file list in flat mode

#### Scenario: User switches to tree mode

- **WHEN** user clicks the view switch control to `tree`
- **THEN** panel SHALL render changed files grouped by directory hierarchy

#### Scenario: Mode preference persistence

- **WHEN** user selects a view mode and reopens the workspace
- **THEN** the selected mode SHALL be restored

---

### Requirement: Tree Hierarchy Interaction

Tree mode SHALL support folder expand/collapse and file selection.

#### Scenario: Expand folder

- **WHEN** user expands a folder node
- **THEN** its child folders/files SHALL be visible

#### Scenario: Collapse folder

- **WHEN** user collapses a folder node
- **THEN** its descendants SHALL be hidden

#### Scenario: File metadata visibility

- **WHEN** tree mode renders file nodes
- **THEN** each node SHALL show file status and additions/deletions summary

---

### Requirement: Single File Diff Focus in Tree Mode

Selecting a file in tree mode SHALL focus diff viewer on that file.

#### Scenario: Select file in tree

- **WHEN** user clicks a file node in tree mode
- **THEN** diff viewer SHALL show that file as focused diff content

#### Scenario: Clear focus

- **WHEN** user triggers “back to all” or clears selection
- **THEN** diff viewer SHALL return to non-focused aggregate state

---

### Requirement: File-Header Controls in Tree Focus Mode

In tree single-file focus mode, diff controls SHALL be attached to the current file header.

#### Scenario: Diff layout switch on file header

- **WHEN** user toggles split/unified controls in file header
- **THEN** current file diff SHALL switch between split and unified layout

#### Scenario: Diff content mode switch on file header

- **WHEN** user toggles `全文查看/区域查看` in file header
- **THEN** content mode SHALL apply to current focused file only

#### Scenario: No duplicated top toolbar

- **WHEN** file-header controls are available
- **THEN** top-level duplicated diff toolbar SHALL NOT be rendered

---

### Requirement: Full View Uses Full-Context Diff

`全文查看` SHALL render full-context diff (including unchanged lines), not only patch-near context.

#### Scenario: Full view data source

- **WHEN** user switches current file to `全文查看`
- **THEN** frontend SHALL request full-context diff for that file
- **AND** full view SHALL include unchanged lines in diff rendering

#### Scenario: Full view status feedback

- **WHEN** full-context diff request resolves
- **THEN** UI SHALL expose request state via button label/status (`FULL/EMPTY/ERR/...`)

---

### Requirement: Floating Change Anchors in Full View

Tree full-view mode SHALL provide floating anchor navigation between change groups.

#### Scenario: Anchor visibility

- **WHEN** current file is in tree mode and `全文查看`
- **THEN** floating anchor control SHALL be visible near diff viewport bottom-right

#### Scenario: Anchor grouping rule

- **WHEN** computing anchors for a file
- **THEN** contiguous changed lines SHALL be grouped as one anchor
- **AND** only line-number jumps create a new anchor

#### Scenario: Anchor navigation

- **WHEN** user clicks prev/next anchor button
- **THEN** viewport SHALL scroll to corresponding change anchor
- **AND** anchor counter SHALL update as `current/total`

---

### Requirement: Backward Compatibility for Git Actions

Existing Git actions SHALL remain available in both view modes.

#### Scenario: Stage/Unstage/Revert in tree mode

- **WHEN** user performs stage/unstage/revert from tree mode
- **THEN** operation behavior SHALL match flat mode semantics

#### Scenario: Commit flow unaffected

- **WHEN** user edits commit message and commits in diff mode
- **THEN** existing commit workflow SHALL work without regression
