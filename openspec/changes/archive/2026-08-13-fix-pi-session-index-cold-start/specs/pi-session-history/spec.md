## ADDED Requirements

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
- **THEN** the next `syncIfNeeded` list MUST treat the PI source as stale
- **AND** MUST upsert the new session id into Session Index

### Requirement: Live PI remap invalidates Session Index

When the client first learns the native PI session id for a pending thread, it MUST invalidate the workspace Session Index so the next list/sync rescans PI.

#### Scenario: Pending PI send caches a native id

- **WHEN** a `pi-pending-*` send receives or recovers native session id `S`
- **THEN** the client MUST call `invalidate_session_index_for_workspace` for the active workspace
- **AND** MUST NOT block the send path on a full Index sync

### Requirement: First-paint may merge PI disk list only when Index has zero PI rows

First-paint MUST NOT enable the generic multi-engine disk-list fan-out. If the Session Index page contains no `engine=pi` rows, the client MAY asynchronously merge `list_pi_sessions` for that workspace as a bounded fallback.

#### Scenario: Empty PI slice on first-paint

- **WHEN** first-paint Session Index returns rows but none have `engine=pi`
- **THEN** the client MAY call `list_pi_sessions` once and merge `pi:<id>` rows
- **AND** MUST NOT start exhaustive full-catalog solely for this fallback
