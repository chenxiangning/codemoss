# pi-session-history Specification

## Purpose

PI CLI 会话的磁盘 IO、侧栏可见性与点开加载。Synced from `add-pi-engine` IO plus `fix-pi-session-continuity-and-sidebar` sidebar/resume.

## Requirements

### Requirement: PI session history IO

The system MUST list, load, and delete PI sessions under the agent sessions directory (`~/.pi/agent/sessions` or env overrides).

#### Scenario: List by workspace

- **WHEN** list_pi_sessions is called with a workspace path
- **THEN** only sessions whose header cwd matches the workspace are returned

#### Scenario: Load transcript

- **WHEN** load_pi_session is called with a valid session id
- **THEN** user, assistant, reasoning, and tool rows are returned in order

### Requirement: Sidebar lists workspace Pi disk sessions

The workspace thread list MUST surface PI sessions for the current workspace. Production first-paint reads Session Index (`sync_pi_engine`); the opt-in `list_pi_sessions` merge is the disk-list fallback. Thread id is `pi:<sessionId>`, engine source `pi`.

#### Scenario: Historical Pi sessions appear after refresh

- **WHEN** `~/.pi/agent/sessions` contains jsonl files whose header cwd matches the active workspace
- **AND** the sidebar loads or refreshes that workspace
- **THEN** each matching session appears as a native thread named from its first user prompt
- **AND** sessions from other workspaces are not shown

#### Scenario: Live Pi thread is not duplicated by disk merge

- **WHEN** a live thread is already remapped to `pi:<sessionId>`
- **AND** `list_pi_sessions` or Session Index returns the same session id
- **THEN** the sidebar keeps a single row for that id

### Requirement: Opening a Pi history thread loads the transcript

Selecting a `pi:<sessionId>` sidebar row MUST load that session through the PI history loader, not the Codex resume path.

#### Scenario: Resume a listed Pi session

- **WHEN** the user opens thread `pi:<sessionId>`
- **THEN** the client calls `load_pi_session` with that id and the workspace path
- **AND** user, assistant, reasoning, and tool rows render in order
- **AND** the client MUST NOT treat the thread as a Codex session
