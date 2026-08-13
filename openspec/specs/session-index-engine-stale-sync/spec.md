# session-index-engine-stale-sync Specification

## Purpose

Session Index list/sync 按引擎 source 决定是否跑 writer。冷启动非空 Index 必须先返回 SQLite，不能用磁盘扫描挡住侧栏 first-paint。Synced from `fix-pi-session-index-cold-start`.

## Requirements

### Requirement: Session Index list syncs stale engines even when the workspace already has rows

`list_session_index_for_workspace` with `syncIfNeeded=true` MUST NOT treat a non-empty workspace Index as proof that every engine is current. The list gate MUST trigger a bounded writer pass when any of these hold for PI, Gemini, or Grok: the engine source row is missing, its stored fingerprint does not match the live fingerprint, or `last_sync_ms` is `0` (invalidated). The gate MUST NOT use the intra-burst age window as the reason to skip those engines.

Warm first-paint is an exception: when the Index already has rows and the caller did not set `forceSync`, the command MUST return existing SQLite rows immediately and MUST NOT wait for PI/Gemini/Grok disk rescans. Incremental rescan belongs to `forceSync` / empty-index paths.

#### Scenario: Existing Claude rows do not skip a stale PI writer

- **WHEN** Session Index already contains Claude or Kimi rows for the workspace
- **AND** the PI source is missing, fingerprint-mismatched, or invalidated
- **AND** the client lists the workspace with `forceSync=true`
- **THEN** the backend MUST run `sync_pi_engine`
- **AND** MUST still avoid exhaustive `list_workspace_sessions`

#### Scenario: Matching PI fingerprint skips only the PI rescan

- **WHEN** the live PI fingerprint matches the stored PI source fingerprint
- **AND** `last_sync_ms` is greater than 0
- **THEN** the list gate MUST NOT treat PI as stale solely because more than 8 seconds have passed
- **AND** Claude / Codex / Kimi light writers MAY still apply their own fingerprint+age skip inside the writer

#### Scenario: Warm first-paint does not wait for PI disk scan

- **WHEN** Session Index already has rows for the workspace
- **AND** first-paint lists with `syncIfNeeded=true` and `forceSync=false`
- **THEN** the command MUST return those SQLite rows without awaiting `list_pi_sessions`

### Requirement: Async engine writers do not serialize behind each other

Gemini, Grok, and PI Session Index writers MUST run concurrently during a workspace sync so a slow or timed-out Gemini/Grok list cannot consume the client first-paint / force-sync budget before PI starts.

#### Scenario: PI writer starts without waiting for Gemini timeout

- **WHEN** `sync_session_index_core` runs Gemini, Grok, and PI writers
- **THEN** the PI writer MUST be started without awaiting Gemini or Grok completion
- **AND** a Gemini timeout MUST NOT prevent PI rows from being committed
