## ADDED Requirements

### Requirement: Detached explorer window provides a self-contained file browsing workspace

The detached file explorer window SHALL render a workspace-scoped file browser with a file tree on the left and a file content area on the right, and it SHALL allow files to be opened without depending on the main window's current panel selection.

#### Scenario: Open file inside detached explorer

- **WHEN** the detached file explorer window is open for a workspace and the user selects a file in the file tree
- **THEN** the selected file is opened in the detached window's file content area
- **AND** the main window does not need to switch to the file panel or editor view to complete the action

#### Scenario: Detached explorer starts with workspace context

- **WHEN** the system opens the detached file explorer window for a workspace
- **THEN** the detached window loads the target workspace context
- **AND** the file tree shown in the detached window belongs to that workspace

### Requirement: Detached explorer manages its own browsing session state

The detached file explorer window MUST maintain its own open tabs, active file, and navigation state independently from the main window.

#### Scenario: Detached window keeps its own open tabs

- **WHEN** the user opens several files in the detached file explorer window
- **THEN** the detached window tracks those open files within its own browsing session
- **AND** the main window's file tabs are not overwritten by the detached window session

#### Scenario: Main window editor changes do not replace detached session

- **WHEN** the user opens or closes files in the main window editor while the detached file explorer window is open
- **THEN** the detached file explorer window keeps its current active file and open tabs unless the user explicitly changes them there

### Requirement: Detached explorer polling follows detached window visibility

The detached file explorer window MUST drive its file-list polling from its own visibility or focus state instead of depending on the main window file panel visibility rules.

#### Scenario: Detached window reduces polling while hidden

- **WHEN** the detached file explorer window becomes hidden or unfocused
- **THEN** the detached explorer reduces or pauses active file polling according to its detached-window policy
- **AND** this behavior does not require the main window file panel to be open

#### Scenario: Detached window resumes polling when visible again

- **WHEN** the detached file explorer window becomes visible or focused again for the same workspace
- **THEN** the detached explorer resumes active polling for that workspace
- **AND** the resumed polling continues to use the detached window's own workspace context

### Requirement: Detached explorer file tree preserves Git status decorations

The detached file explorer window SHALL render Git-aware file status decorations in its file tree using the same status categories and visual semantics as the embedded file tree.

#### Scenario: Detached file tree shows Git status for changed files

- **WHEN** the detached file explorer window displays a workspace that contains tracked file changes
- **THEN** changed files in the detached file tree show Git status decorations (for example modified, added, deleted) with the same semantic mapping used by the embedded file tree
- **AND** users can distinguish changed files from unchanged files directly in the detached tree

#### Scenario: Detached Git decoration stays in sync after refresh

- **WHEN** Git file status changes and the detached file explorer refreshes or polls the workspace
- **THEN** the detached file tree updates its Git decorations to the latest status snapshot
- **AND** stale status colors or markers are not kept after the new status is available

### Requirement: Detached file viewer supports diff-aware color rendering

The detached file explorer window SHALL provide diff-aware color rendering in the file content area so users can visually distinguish added, removed, modified, and context lines while reading opened files.

#### Scenario: Detached viewer renders diff line semantics

- **WHEN** the user opens a file with diff information available in the detached file explorer window
- **THEN** the detached file content area renders line-level diff semantics with distinct colors for added, removed, modified, and context lines
- **AND** the diff color semantics are consistent with the embedded file-viewing surface

#### Scenario: Detached viewer falls back safely when diff data is unavailable

- **WHEN** the user opens a file in the detached file explorer window and diff metadata is not available for that file
- **THEN** the detached file content area still renders readable file content
- **AND** the system does not display incorrect diff coloring that implies unavailable change states
