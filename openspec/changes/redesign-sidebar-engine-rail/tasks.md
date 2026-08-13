## 1. Index tombstone

- [x] 1.1 给 `session_index` 增加 `tombstoned_at` 幂等列；list 过滤；upsert 不复活
- [x] 1.2 增加 `tombstone_session_index_rows` 并在 `delete_workspace_sessions_core` 成功/失败后都写入
- [x] 1.3 Rust 测试：tombstone 后 list 不含该行；upsert 不清除标记

## 2. Index-only hydrate

- [x] 2.1 first-paint 跳过 Codex live `listThreads` membership 翻页
- [x] 2.2 `useWorkspaceRestore` 对已 hydrate workspace 短路
- [x] 2.3 补/改 Vitest：first-paint 不调 `listThreads`；restore 不二次 list

## 3. Engine rail UI

- [x] 3.1 新增 rail 工具：解析 engine key、按轨过滤、持久化当前轨
- [x] 3.2 Sidebar 在 `getThreadRows` 前按轨过滤；左轨 logo 切换；空轨不画
- [x] 3.3 Vitest：轨切换、空轨、Shared 第一、child 仍缩进

## 4. 过滤冻结回归

- [x] 4.1 重跑 Shared hide / 下崽 / parent 树既有测试，确认零改语义
- [x] 4.2 `openspec validate redesign-sidebar-engine-rail --strict --no-interactive`

## 5. 指南回写

- [x] 5.1 `workspace-session-catalog-contract.md` 补「侧栏 UI = rail，membership = Index」
