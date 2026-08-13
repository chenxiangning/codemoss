## ADDED Requirements

### Requirement: External CLI sessions MUST import off the sidebar load path

系统 MUST 在 App 进程后台按间隔把已登记工作区的外部 CLI 会话导入 Session Index。该循环 MUST NOT 由侧栏 first-paint 同步调用。

#### Scenario: first-paint does not wait for importer

- **WHEN** 工作区执行侧栏 first-paint
- **THEN** 客户端 MUST 只 `list_session_index_for_workspace` + Shared
- **AND** MUST NOT await 本 importer tick

### Requirement: Import MUST be bounded, deduped, and idempotent

导入 MUST 使用现有有界 writers（`force=false`、fingerprint skip、Codex recent-first、limit）。写入 MUST `ON CONFLICT(engine, session_id)`。tombstone 行 MUST NOT 被导入复活。重叠 tick MUST 跳过。

#### Scenario: second tick does not duplicate a row

- **WHEN** 同一 `(engine, session_id)` 已被导入
- **AND** importer 再次 tick
- **THEN** Index MUST 仍只有一行
- **AND** upsert MUST 只更新字段或不写

#### Scenario: overlapping tick is skipped

- **WHEN** 上一 tick 仍在跑
- **AND** 间隔到期
- **THEN** 新 tick MUST 立即返回
- **AND** MUST NOT 并行再开一套 writers

### Requirement: Successful import MAY notify the sidebar to re-read SQLite

若 tick 的 `upserted > 0`，系统 MUST emit `session-index-imported`。侧栏 MUST 只用 first-paint 再 SELECT，MUST NOT 因此打开磁盘 `list_*_sessions`。

#### Scenario: upsert notifies visible workspaces

- **WHEN** importer 为 workspace A 写入至少一行
- **THEN** 事件 MUST 包含 A 的 id
- **AND** 侧栏若展示 A MUST 再跑 Index-only first-paint
