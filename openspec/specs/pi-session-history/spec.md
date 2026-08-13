# pi-session-history Specification

## Purpose

PI CLI 会话的磁盘 IO、侧栏可见性与点开加载。Synced from `add-pi-engine` IO, `fix-pi-session-continuity-and-sidebar` sidebar/resume, and `fix-pi-session-index-cold-start` cold-start projection.

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

### Requirement: Cold-start sidebar shows workspace PI disk sessions from Session Index

After process restart, first-paint MUST surface PI sessions whose jsonl header cwd matches the active workspace. Production still reads Session Index first. The PI writer MUST run when the PI source is stale even if other engines already have Index rows. Thread id remains `pi:<sessionId>`, engine source `pi`.

#### Scenario: Restart after a live PI turn keeps the row

- **WHEN** a Native PI turn has written `~/.pi/agent/sessions/<cwd>/<timestamp>_<sessionId>.jsonl`
- **AND** the user restarts the app and the sidebar first-paints that workspace
- **THEN** the session MUST appear as `pi:<sessionId>` named from its first user prompt
- **AND** the system MUST NOT require a live remap or `includeEngineDiskLists` for that row to exist

#### Scenario: New jsonl in an existing cwd directory is indexed

- **WHEN** a new PI jsonl is added under an existing `sessions/<encoded-cwd>/` directory
- **AND** the parent `sessions/` directory mtime does not change
- **THEN** the next `forceSync` list MUST treat the PI source as stale
- **AND** MUST upsert the new session id into Session Index

### Requirement: Live PI remap invalidates Session Index

When the client first learns the native PI session id for a pending thread, it MUST invalidate the workspace Session Index so the next list/sync rescans PI.

#### Scenario: Pending PI send caches a native id

- **WHEN** a `pi-pending-*` send receives or recovers native session id `S`
- **THEN** the client MUST call `invalidate_session_index_for_workspace` for the active workspace
- **AND** MUST NOT block the send path on a full Index sync

### Requirement: First-paint may merge PI disk list only when Index has zero PI rows

First-paint MUST NOT enable the generic multi-engine disk-list fan-out. If the Session Index page contains no `engine=pi` rows, the client MAY asynchronously merge `list_pi_sessions` for that workspace as a bounded fallback. If Shared native visibility is not yet verified, the client MUST still project Index `engine=pi` rows into the sidebar instead of dropping the entire Index page.

#### Scenario: Empty PI slice on first-paint

- **WHEN** first-paint Session Index returns rows but none have `engine=pi`
- **THEN** the client MAY call `list_pi_sessions` once and merge `pi:<id>` rows
- **AND** MUST NOT start exhaustive full-catalog solely for this fallback

### Requirement: Opening a Pi history thread loads the transcript

Selecting a `pi:<sessionId>` sidebar row MUST load that session through the PI history loader, not the Codex resume path.

#### Scenario: Resume a listed Pi session

- **WHEN** the user opens thread `pi:<sessionId>`
- **THEN** the client calls `load_pi_session` with that id and the workspace path
- **AND** user, assistant, reasoning, and tool rows render in order
- **AND** the client MUST NOT treat the thread as a Codex session
