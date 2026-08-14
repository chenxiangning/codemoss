# Tasks: restore-sidebar-flat-list-and-index-backfill

## 1. 外观还原（删除 engine rail）

- [x] 1.1 `Sidebar.tsx` 移除 rail state / 过滤 / 渲染 / 跟随 effect / CSS import
- [x] 1.2 删除 `SidebarEngineRail.tsx`、`sidebarEngineRail.ts`、`sidebarEngineRail.test.ts`、`sidebar.engine-rail.css`
- [x] 1.3 修正引用 rail 的测试，vitest 绿

## 2. Backfill store + writers

- [x] 2.1 `session_index_backfill` 表 + load/save cursor + complete 标记（store.rs）
- [x] 2.2 Claude backfill：mtime desc offset 批
- [x] 2.3 Codex backfill：date-partition 倒序游标批（非分区布局回退 mtime offset）
- [x] 2.4 Kimi backfill：session_index.jsonl 匹配行 offset 批
- [x] 2.5 Gemini / Grok / PI backfill：lister limit 递增分页批；OpenCode 直接 complete（skip，无磁盘索引）
- [x] 2.6 `backfill_session_index_core(state, workspace_id)` 串行跑各 engine 一批

## 3. Importer 集成

- [x] 3.1 `run_import_tick` 尾部追加 backfill；upserted 计入 `session-index-imported` 事件
- [x] 3.2 backfill complete 的 `(engine, workspace)` 不再扫盘

## 4. 侧栏 Load Older（SQLite 分页）

- [x] 4.1 `SessionIndexListPage.totalCount`（COUNT 查询）
- [x] 4.2 cursor source `session-index`：encode/decode + `resolveThreadListCursorForDisplay` 合成
- [x] 4.3 `useThreadActionsLoadOlder` 处理 `session-index` source：递增 limit 重查 + merge
- [x] 4.4 vitest：loadOlder session-index source + hydration 合同更新

## 5. Spec / 验收

- [x] 5.1 capability deltas（sidebar-engine-rail REMOVED、workspace-sidebar-session-loading MODIFIED、session-index-backfill ADDED）
- [x] 5.2 `cargo test session_index` 绿
- [ ] 5.3 人工：本机 Codex corpus 逐 tick 收敛验证 + 侧栏目视验收
