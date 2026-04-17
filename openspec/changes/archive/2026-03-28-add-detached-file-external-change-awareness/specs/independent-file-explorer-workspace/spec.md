## ADDED Requirements

### Requirement: Detached explorer shall detect external file changes for opened tabs
The detached file explorer window MUST detect external on-disk changes for files opened in its tab session and MUST surface state transitions for the active file without requiring manual refresh.

#### Scenario: Active opened file is changed externally
- **WHEN** the active file in detached explorer is modified by an external process
- **THEN** the detached explorer SHALL enter an external-change state for that file within the configured detection window

#### Scenario: Unopened file changes do not trigger editor conflict UI
- **WHEN** a file not opened in detached explorer tabs is modified externally
- **THEN** the system SHALL update workspace snapshots as needed but SHALL NOT show active editor conflict prompt for the current tab

### Requirement: Detached explorer shall auto-sync clean files after external changes
If the active file has no unsaved local edits, the detached explorer MUST auto-reload to latest on-disk content and SHALL provide a non-blocking visibility cue.

#### Scenario: Clean active file auto refreshes
- **WHEN** external change is detected and current editor buffer is clean
- **THEN** the editor content SHALL reload from disk automatically and remain readable without manual action

#### Scenario: Auto-sync cue remains non-blocking
- **WHEN** clean file auto-sync completes
- **THEN** the UI SHALL show a lightweight sync cue and SHALL NOT block continued reading or navigation

### Requirement: Detached explorer shall protect dirty buffers from silent overwrite
If the active file contains unsaved local edits, the detached explorer MUST NOT overwrite the buffer silently and MUST require explicit user decision.

#### Scenario: Dirty active file receives external change
- **WHEN** external change is detected while the active file buffer is dirty
- **THEN** the system SHALL present conflict actions including reload-from-disk, keep-local, and compare-before-decision

#### Scenario: Conflict resolution converges state
- **WHEN** the user selects one conflict action
- **THEN** the external-change state, dirty indicator, and visible content SHALL converge to a consistent post-action state

### Requirement: External change handling shall enforce Win/mac compatibility normalization
The external-change pipeline MUST normalize paths and deduplicate events with platform-aware semantics to avoid duplicate or missed prompts on Windows and macOS.

#### Scenario: Windows path case variance is treated as same file
- **WHEN** external events arrive for the same Windows file path using different case forms
- **THEN** the system SHALL resolve them as one logical file and SHALL NOT create duplicate conflict prompts

#### Scenario: macOS rename-plus-change burst is coalesced
- **WHEN** macOS emits sequential rename/change events for one save operation
- **THEN** the system SHALL debounce/coalesce the burst and SHALL emit at most one effective conflict/sync transition for that save

### Requirement: Detached explorer shall degrade gracefully when watcher is unavailable
The detached explorer MUST fall back to bounded polling when watcher delivery is unavailable and MUST preserve conflict-protection guarantees.

#### Scenario: Watcher unavailable triggers fallback
- **WHEN** watcher initialization or delivery fails
- **THEN** the system SHALL switch to bounded polling for detached active file updates without disabling external-change awareness

#### Scenario: Fallback still honors dirty protection
- **WHEN** fallback polling detects an external change for a dirty active file
- **THEN** the system SHALL apply the same no-silent-overwrite conflict prompt behavior as watcher mode

### Requirement: External-change scope shall remain isolated to detached window context
External-change actions triggered by this capability MUST be limited to the detached window's current workspace and opened tabs.

#### Scenario: No cross-window forced refresh
- **WHEN** detached explorer processes an external-change event
- **THEN** it SHALL NOT force refresh or conflict prompt in unrelated windows

#### Scenario: No cross-workspace contamination
- **WHEN** detached explorer is bound to workspace A
- **THEN** external-change handling for this capability SHALL ignore events from workspace B
