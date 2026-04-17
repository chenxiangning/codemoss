# Git History Panel Specification

## ADDED Requirements

### Requirement: Four-Region Git Log Workspace

The system SHALL provide a four-region Git History workspace that mirrors the core interaction model of IDEA Git Log.

#### Scenario: Open panel from sidebar

- **WHEN** user clicks the Git History icon in the left sidebar rail
- **THEN** the system opens a four-region panel:
    - Left: overview (working tree summary)
    - Left-center: branch list
    - Right-center: commit log with graph
    - Right: commit details (file list + commit message)

#### Scenario: Right column split layout

- **WHEN** the panel is open
- **THEN** the right column SHALL be split vertically into:
    - Top: changed files list
    - Bottom: selected commit message

#### Scenario: Click file to preview diff in modal

- **WHEN** user clicks a file item in changed files list
- **THEN** the system opens a modal diff preview for that file
- **AND** commit details main layout SHALL remain unchanged

---

### Requirement: Panel State Persistence

The system SHALL persist panel UI state to restore user context.

#### Scenario: Restore layout state

- **WHEN** user reopens the panel
- **THEN** the system restores previously saved column widths and split ratio

#### Scenario: Restore navigation state

- **WHEN** user reopens the panel
- **THEN** the system restores selected branch, selected commit, and active filters when still valid

#### Scenario: Persist open or closed state

- **WHEN** user closes and restarts the application
- **THEN** the panel open/closed state SHALL be restored

---

### Requirement: Commit Log Table Structure

The middle column SHALL display commit rows with graph and key metadata columns.

#### Scenario: Commit row rendering

- **WHEN** commit rows are loaded
- **THEN** each row shows:
    - Graph node/edges
    - Subject line
    - Ref labels (branch/tag)
    - Author
    - Relative time

#### Scenario: Truncated subject with full tooltip

- **WHEN** subject exceeds row width
- **THEN** row shows truncated text and full subject on hover tooltip

---

### Requirement: Keyboard Navigation Inside Panel

The system SHALL support keyboard navigation for history browsing.

#### Scenario: Arrow navigation

- **WHEN** user presses `↑` or `↓`
- **THEN** the previous/next commit row becomes selected

#### Scenario: Enter on selected row

- **WHEN** user presses `Enter` on a selected commit
- **THEN** the right column SHALL focus that commit details

#### Scenario: Escape closes panel

- **WHEN** user presses `Escape`
- **THEN** the Git History panel SHALL close

---

### Requirement: Loading, Error and Empty States

The panel SHALL expose clear operational states.

#### Scenario: Loading history

- **WHEN** commit history is being fetched
- **THEN** middle column shows loading indicator

#### Scenario: Backend error

- **WHEN** history fetch fails
- **THEN** middle column shows user-friendly error with `Retry` action

#### Scenario: Empty repository

- **WHEN** repository has no commits
- **THEN** middle column shows "No commits found in this repository"

---

### Requirement: Theme and Visual Consistency

The panel SHALL follow application theme variables.

#### Scenario: Dark theme

- **WHEN** application is in dark mode
- **THEN** panel and diff colors follow dark theme tokens with readable contrast

#### Scenario: Light theme

- **WHEN** application is in light mode
- **THEN** panel and diff colors follow light theme tokens with readable contrast

---

### Requirement: Large History Performance Baseline

The commit log SHALL remain usable for large repositories.

#### Scenario: Virtualized rendering

- **WHEN** repository has more than 10,000 commits
- **THEN** the commit list uses virtual scrolling and renders only visible rows plus buffer

#### Scenario: Incremental loading

- **WHEN** user scrolls near list bottom
- **THEN** system loads next page (default 100 commits) without blocking current interactions
