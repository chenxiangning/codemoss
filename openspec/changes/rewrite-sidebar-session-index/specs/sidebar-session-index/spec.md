# Capability: sidebar-session-index

## Purpose

Define the **list-level** session source for the conversation Sidebar: a local SQLite Session Index fed by engine-native light indexes and bounded disk walks. Exhaustive multi-engine catalog projection is **not** the sidebar cold path.

## Requirements

### Requirement: Sidebar list uses Session Index

The system SHALL load sidebar thread summaries for a workspace primarily from `list_session_index_for_workspace` (SQLite), not from exhaustive `list_workspace_sessions` with full multi-engine inventory.

#### Scenario: Cold-start first-paint

- **WHEN** the active workspace performs first-paint thread list hydration
- **THEN** the client MUST request Session Index with `syncIfNeeded=true`
- **AND** MUST merge returned rows into sidebar summaries before or without waiting for full-catalog
- **AND** MUST NOT require `list_workspace_sessions` to complete for the sidebar to become interactive

#### Scenario: Index miss triggers bounded sync

- **WHEN** Session Index has no rows for the workspace path
- **THEN** backend MUST run light writers (at least Claude project-dir + Codex ThreadPreview + Kimi index when present)
- **AND** MUST NOT perform Full JSONL archive parse for sidebar sync

### Requirement: Codex preview does not walk entire archive

ThreadPreview Codex scanning MUST collect candidates recent-first with an early stop budget and MUST NOT enumerate every JSONL under `sessions/**` solely to return a small page.

#### Scenario: Date-partitioned roots

- **WHEN** a Codex sessions root uses `YYYY/MM/DD` layout
- **THEN** candidate collection MUST walk year/month/day in reverse chronological order
- **AND** MUST stop once the candidate budget is reached

### Requirement: No automatic full-catalog after first-paint settle

After active workspace first-paint succeeds and the startup gate is ready, the system MUST NOT automatically enqueue multi-engine `full-catalog` hydration solely to “complete” the sidebar.

#### Scenario: Gate ready from first-paint

- **WHEN** active first-paint completes successfully
- **THEN** `startup-gate-ready` MAY be stamped for first-paint-complete
- **AND** the workspace MAY be marked fully settled for soft refresh purposes
- **AND** exhaustive full-catalog MUST remain available for force refresh, Session Management, and load-older flows only

### Requirement: Writers prefer native light indexes

- Claude writer MUST prefer `~/.claude/history.jsonl` titles and the workspace’s encoded project directory file mtimes
- Codex writer MAY use `session_index.jsonl` for titles and ThreadPreview for cwd-filtered membership
- Kimi writer MUST prefer `session_index.jsonl` when present

#### Scenario: Fresh fingerprint skip

- **WHEN** source fingerprint and last_sync are within the configured freshness window
- **THEN** sync MAY skip rescan and list from existing SQLite rows

### Requirement: Extended engine writers are bounded

Gemini, Grok, and OpenCode writers MAY participate in Session Index sync but MUST use hard timeouts (seconds-level). OpenCode failure or absence MUST soft-empty without failing the whole index sync.

#### Scenario: OpenCode CLI missing

- **WHEN** OpenCode is not installed or disabled
- **THEN** Session Index sync MUST still succeed for other engines
- **AND** OpenCode rows MAY be empty with a partial source diagnostic

#### Scenario: Quiet post first-paint index soft re-sync

- **WHEN** active first-paint completes
- **THEN** the system MAY schedule one quiet Session Index soft re-sync (first-paint + preserveState)
- **AND** MUST NOT automatically schedule exhaustive multi-engine full-catalog for that settle
