# session-index-backfill

## ADDED Requirements

### Requirement: Historical sessions MUST backfill incrementally off the sidebar path

系统 MUST 在 import daemon tick 尾部为每个 `(engine, workspace)` 执行**一个**有界 backfill 批，使用持久化游标向更老历史推进，直到标记 `complete`。backfill MUST NOT 由侧栏 first-paint 同步调用，MUST NOT 全树 walk。

#### Scenario: single tick processes one bounded batch

- **WHEN** importer tick 到达 workspace A
- **AND** workspace A 的 codex backfill 未 complete
- **THEN** 该 tick MUST 只处理 ≤2 个日期分区
- **AND** MUST 推进持久化游标

#### Scenario: completed backfill stops scanning

- **WHEN** `(engine, workspace)` 的 backfill 已标记 complete
- **AND** importer 再次 tick
- **THEN** 系统 MUST NOT 为该 source 再枚举磁盘文件

### Requirement: Backfill writes MUST be idempotent and tombstone-safe

backfill 写入 MUST 复用 `upsert_rows`（`ON CONFLICT(engine, session_id)`，tombstone 行不复活）。游标漂移 MUST 至多造成重复 upsert，MUST NOT 丢行。

#### Scenario: tombstoned session stays hidden after backfill

- **WHEN** 用户删除的会话已 tombstone
- **AND** backfill 批再次扫到该会话文件
- **THEN** Index 中该行 MUST 保持 tombstoned
- **AND** 侧栏 MUST NOT 重新显示它

### Requirement: Sidebar MUST page older sessions from SQLite only

`list_session_index_for_workspace` MUST 返回 `totalCount`。侧栏「加载更早」在 catalog/runtime cursor 缺失且 `totalCount > 已加载数` 时 MUST 可用，其数据源 MUST 只是更大 limit 的 SQLite SELECT，MUST NOT 触发磁盘 `list_*_sessions` / catalog。

#### Scenario: load older reveals backfilled history without disk scan

- **WHEN** 侧栏已显示最近 N 条且 `totalCount > N`
- **AND** 用户点击「加载更早」
- **THEN** 客户端 MUST 以递增 limit 重查 Session Index 并 merge
- **AND** diagnostic MUST NOT 出现 exhaustive catalog / 磁盘 session list 调用
