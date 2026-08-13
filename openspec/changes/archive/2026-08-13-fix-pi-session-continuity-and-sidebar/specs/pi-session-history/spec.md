## ADDED Requirements

### Requirement: Sidebar lists workspace Pi disk sessions

The workspace thread list MUST merge PI sessions returned by `list_pi_sessions` for the current workspace path, using thread id `pi:<sessionId>` and engine source `pi`.

#### Scenario: Historical Pi sessions appear after refresh

- **WHEN** `~/.pi/agent/sessions` contains jsonl files whose header cwd matches the active workspace
- **AND** the sidebar loads or refreshes that workspace
- **THEN** each matching session appears as a native thread named from its first user prompt
- **AND** sessions from other workspaces are not shown

#### Scenario: Live Pi thread is not duplicated by disk merge

- **WHEN** a live thread is already remapped to `pi:<sessionId>`
- **AND** `list_pi_sessions` returns the same session id
- **THEN** the sidebar keeps a single row for that id

### Requirement: Opening a Pi history thread loads the transcript

Selecting a `pi:<sessionId>` sidebar row MUST load that session through the PI history loader, not the Codex resume path.

#### Scenario: Resume a listed Pi session

- **WHEN** the user opens thread `pi:<sessionId>`
- **THEN** the client calls `load_pi_session` with that id and the workspace path
- **AND** user, assistant, reasoning, and tool rows render in order
- **AND** the client MUST NOT treat the thread as a Codex session
