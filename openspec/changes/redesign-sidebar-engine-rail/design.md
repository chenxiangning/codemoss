# Design: redesign-sidebar-engine-rail

## Context

侧栏 list 已有 Session Index（`~/.ccgui/session-index.sqlite3`），但 `useThreadActionsListThreadsForWorkspace` 仍在 first-paint 后并 Codex live 翻页；`useWorkspaceRestore` 1.5s 后再打一遍。过滤规则（Shared hide、下崽、parent 树）已经正确，不能重写。

UI 定案为方案 D：左 logo 轨，右只看当前 CLI。

## Goals / Non-Goals

**Goals:**

- 普通 hydrate = Index + 既有过滤投影
- 删除 = Index tombstone 先于磁盘
- Sidebar 用 engine rail 展示，不改 membership 语义

**Non-Goals:**

- 不改 hide / parent / archive / hidden-auto 实现
- 不重写 Index writers
- 不改 Transcript Loader / Session Management 默认 catalog

## Decisions

### D1. first-paint 跳过 Codex live membership 翻页

- **选**：`startupHydrationMode === "first-paint"` 时不进入 `listThreads` do-while。
- **不选**：保留 live 页当「更快的 Codex」。Index 已有 Codex 行；live 页是重复且会拖慢。
- Force refresh / `full-catalog` 仍可走旧 merge。

### D2. restore 二次 list 直接短路

- **选**：`useWorkspaceRestore` 若 workspace 已在 hydrated set，不再 `listThreadsForWorkspace`。
- **不选**：删掉整个 restore hook（还负责 reconnect 边界，先不动）。

### D3. tombstone 列而不是物理删 Index 行

- **选**：`session_index.tombstoned_at INTEGER`；list `WHERE tombstoned_at IS NULL`；upsert `ON CONFLICT ... WHERE tombstoned_at IS NULL`。
- **不选**：硬删行。Writer 下次 sync 会按磁盘复活。
- 删除路径：现有 `delete_*` 之后（或之前）调用 `tombstone_session_index_rows`。前端已有 `deletedThreadIds`；tombstone 保证重启仍藏。

### D4. Rail 是展示过滤器

- **选**：`getProjectedThreads` 之后、`getThreadRows` 之前按 rail 过滤。`useThreadRows` 原样。
- **不选**：在 reducer 里按 engine 分桶。会破坏 hide / parent 输入完整性。
- 持久化：`localStorage` key `mossx.sidebarEngineRail.<workspaceId>`。
- 默认轨：active thread 所属 → 持久化值（若仍有行）→ Shared → 第一条有行的轨。

### D5. 不过滤层

实现与 review 禁止改这些文件的规则语义：

- `sharedNativeVisibility.ts`
- `isSharedSidebarHiddenPup` / `buildSharedSidebarHiddenParentKeys`
- `useThreadRows` 的 parent 树算法
- `applySessionArchiveState` 可见性判定

## Risks / Trade-offs

- [Risk] first-paint 不再拉 Codex live，Index 空时 Codex 轨暂时空 → [Mitigation] 空 Index 仍允许 `syncIfNeeded` writer；force 刷新走 catalog。
- [Risk] writer 复活已删会话 → [Mitigation] upsert 跳过 tombstone 行。
- [Risk] Rail 过滤漏掉 child → [Mitigation] 按 `engineSource`/`shared` 过滤，child 与父同 engine；树算法不变。
- [Risk] 用户找不到「全部」平铺 → [Mitigation] 方案 D 刻意取舍；轨上可见全部有会话的 CLI。

## Migration Plan

1. 加 tombstone 列（`ALTER TABLE` 幂等）。
2. 收 first-paint / restore。
3. 接删除 tombstone。
4. 上 rail UI。
5. 回滚：删 rail 组件 + 恢复 live 翻页 flag；tombstone 列可留（只多过滤）。

## Open Questions

无。用户已选 D，过滤冻结。
