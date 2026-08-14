# Design: restore-sidebar-flat-list-and-index-backfill

## 决策记录

### D1. 外观还原 = 物理删除 rail，而非 feature flag

engine rail 是纯 UI 层（`SidebarEngineRail.tsx` + `sidebarEngineRail.ts` + `sidebar.engine-rail.css` + `Sidebar.tsx` 内状态/过滤/渲染）。数据层（Session Index、first-paint merge、import daemon）与 rail 无耦合。用户已判定外观不可接受，留 flag 即留死代码，故整体删除：

- 删 `src/features/app/components/SidebarEngineRail.tsx`
- 删 `src/features/app/utils/sidebarEngineRail.ts`（+ test）
- 删 `src/styles/sidebar.engine-rail.css`
- `Sidebar.tsx`：移除 `engineRailByWorkspaceId` state、`handleSelectEngineRail`、active-thread→rail 跟随 effect、`threadRowsByWorkspace` 内的 `filterThreadsForEngineRail`、`renderWorkspaceEntry` 内 rail 计算与 `sidebar-engine-rail-row` 包裹层
- localStorage key `mossx.sidebarEngineRail.*` / `mossx.sidebarEngineRailsSeen.*` 成为孤儿，无需清理（无害）

### D2. Backfill 挂在现有 import daemon tick 尾部

不新建调度循环。`run_import_tick` 现有语义：串行工作区 → `sync_session_index_core`（recent 窗口，fingerprint skip）。在其后追加 `backfill_session_index_core`：同一工作区、同一 tick 内各 engine 各跑**一个**有界批。tick 间隔 90s、重叠 tick 跳过等既有治理全部复用。

单批预算（宁可小不可大，总耗时摊在后台）：

| Engine | 游标语义 | 单批 |
|--------|----------|------|
| Codex | 最后已处理日期分区路径（如 `2026/07/01`） | ≤2 个分区内的全部文件（ThreadPreview 解析，过滤 workspace） |
| Claude | mtime desc 排序文件列表的 offset | 100 个文件 |
| Kimi | `session_index.jsonl` 已匹配行数 offset | 100 行匹配 |
| Gemini / Grok / PI | 已覆盖条数 offset（lister 结果 recent-first） | limit = offset + 200，取尾部切片 upsert |
| OpenCode | — | 直接标记 complete（无磁盘索引） |

游标持久化到新表 `session_index_backfill(source_key, cursor, complete, updated_ms)`，`source_key = "{engine}:{workspace_path}"`，与 `session_index_sources` 同键规约。

### D3. Codex 分区游标用「分区路径」而非 offset

新分区只会出现在**最近端**，offset 游标会错位漏扫；「严格比 cursor 更老的分区」语义对新分区免疫。单分区文件数有界（一天一个 workspace 的 rollout 数量级小），整分区处理不需要区内 offset。

非日期分区布局（老 corpus）：回退 `collect_jsonl_files_capped` 有界 shallow walk，按 mtime desc + offset 游标（同 Claude 语义）。

### D4. 侧栏「加载更早」= SQLite 递增 limit 重查，不引入磁盘 paging

- `SessionIndexListPage` 增加 `totalCount`（`(workspace_path = ? OR cwd = ?) AND tombstoned IS NULL` 的 COUNT，便宜）。
- FE cursor 新增 source `session-index`，payload 为当前已用 limit：`session-index::100`。
- `resolveThreadListCursorForDisplay`：catalog/runtime cursor 都没有、且 `totalCount > data.length` 时合成 `session-index::{limit}`。
- `useThreadActionsLoadOlder` 命中 `session-index` source：用 `limit + 100`（clamp 500/引擎）重跑 `listSessionIndexForWorkspace(syncIfNeeded: false)`，rows→summaries 与现有列表 merge（复用 `sessionIndexRowsToThreadSummaries` + setThreads merge），再按新 `totalCount` 决定下一次 cursor。
- 每次点击纯 SQLite SELECT，毫秒级；backfill 在后台持续抬高 `totalCount`，用户翻页与后台回填自然汇合。

### D5. Shared / 可见性投影语义不变

backfill 只写 native engine 行；Shared visibility projection（`shared_visibility.rs`）只在 list 时叠加，不受影响。tombstone 由 `upsert_rows` 既有 `WHERE tombstoned_at IS NULL` 防复活，backfill 复用同一 `upsert_rows`，天然免疫。

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| Backfill 与 recent sync 同事务竞争 | 两者都走 `open_connection` + WAL + busy_timeout 3s；tick 内串行执行 |
| Claude/Kimi offset 游标因文件变化漂移 | offset 只用于「比最近窗口更老」的补齐；漂移最多重复 upsert（幂等），不会丢行——recent 窗口 writer 始终覆盖头部 |
| 回填期间 `totalCount` 上涨导致用户以为列表抖动 | 「加载更早」是显式点击；first-paint limit 不变，列表头部稳定 |
| rail 删除后有测试引用 | 同步删 `sidebarEngineRail.test.ts`，修正 Sidebar 相关测试 |

## 验证

- `cargo test session_index`：backfill cursor 单测（claude offset / codex 分区 / kimi 行 offset / complete 标记 / tombstone 不复活）
- vitest：`Sidebar` 无 rail 渲染快照、loadOlder `session-index` source 单测、hydration 合同测试更新
- 人工：本机 2.6GB Codex corpus 观察 tick 日志，确认无全树 walk、行数逐 tick 增长至收敛
