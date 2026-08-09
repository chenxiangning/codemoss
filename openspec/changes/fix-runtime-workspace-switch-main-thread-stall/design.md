# Design: fix-runtime-workspace-switch-main-thread-stall

## Problem model（2026-08-08 复测后校准）

```text
User: Project1 shared → Project2 shared
  activeWorkspaceId changes
  useAppShellSearchRadarSection requests projection summary immediately
    get_workspace_session_projection_summary(limit=9999)
      Codex → Claude source facts/cache rebuild → Gemini → Kimi → Grok
      → OpenCode external CLI → Shared
  // independent from list generation; cancelWorkspaceTasks cannot stop it

  selectWorkspace(B) + setActiveThreadId(shared:…)
  cancelWorkspaceTasks(A)  // soft-ignore: free slot, abort signal, mark generation stale
  ensure list(B) starts immediately
  orphan list(A) body STILL runs:
    titles → shared → codex pages → start multi-engine promises → merge → maybe setThreads skip
    + fire-and-forget gemini/kimi/grok that only checked requestSeq (not isStale)
  + shared history hydrate on B
  → CPU + main thread stack → 5–10s freeze
```

Cold-start gate does **not** cover this path (gate already ready)。首轮 early-stale 修复只处理下半段 orphan list；用户复测未改善，说明上半段 independent exhaustive projection 才是主链路。

## Approach

### D1 — Cooperative early exit in `listThreadsForWorkspace`（已完成，次要止损）

Introduce a local helper used at stage boundaries:

```ts
const abandonIfStale = (): { applied: false; stale: true } | null =>
  isLatestThreadListRequest() ? null : { applied: false, stale: true };
```

`isLatestThreadListRequest` already means:

```ts
threadListRequestSeqRef[workspace.id] === requestSeq && !(options?.isStale?.() ?? false)
```

**Checkpoints (must):**

| Stage | When |
|-------|------|
| Before titles IPC | entry of try (after setup) |
| After titles | before shared sessions |
| After shared sessions | before codex paging |
| Each codex page | after await, before next page / more work |
| Before multi-engine promise construction | must not *start* catalog/claude/opencode if stale |
| After Promise.allSettled | keep existing |
| Before yield + setThreads | keep existing |
| gemini/kimi/grok background | use `isLatestThreadListRequest()` not bare seq |

### What we accept

- One already-in-flight invoke may finish after cancel (no hard IPC abort).
- After that settle, body returns and starts **no further** stages.

### What we do not do in MVP

- Hard-abort native list commands.
- History hydrate chunking for Shared.
- AppShell structural split.

### D2 — AppShell owner topology MUST be local derived data（主修复）

AppShell 只消费 `summary.ownerWorkspaceIds`，不消费 active/archive/folder counts。owner scope 已完整存在于 `workspaces`：

```text
active id absent            => []
active id registry pending  => [active id]
active workspace=worktree   => [active id]
active workspace=main       => [active id, ...direct parentId children sorted by path/name/id]
```

新增 pure resolver 并在 render 内 `useMemo` 推导；删除 AppShell 对 `useWorkspaceSessionProjectionSummary` 的依赖。该算法镜像 Rust `catalog_workspace_scope`，以 `parentId` 兼容 legacy missing-kind child，只决定哪些 owner list 参与 Sidebar/Recent/Radar 聚合，不重新实现 session membership。

Settings/Session Management 仍调用 projection summary，因为该 surface 确实消费 totals、folder counts 与 source statuses。API 和 backend exhaustive semantics 本轮不改。

### D3 — 为什么不回退 Claude scanner v5

v5 修复 CJK path bucket collision 与 transcript cwd 越界归属，是 correctness 修复。回退会重新泄漏 foreign sessions。正确做法是让 navigation 不触发 exhaustive scan，使 cache rebuild 只发生在显式管理/有界 catalog 路径，而不是恢复错误 cache。

### D4 — 为什么不撤销 hydration race 修复

`9e3c1bdd8` 保证 `workspacesById` 到达后 first-paint 一定执行，修复真实的 Sidebar 永久“加载中…”问题。不能用恢复竞态跳过工作来换取表面性能；应让被稳定执行的路径本身有界。

## Test plan

1. **Unit**: mid-flight `isStale` flips true after titles → `listThreads` / `listWorkspaceSessions` / gemini not called (or not beyond injection point); no `setThreads`.
2. **Unit**: local topology covers main + direct worktrees、worktree isolation、registry pending fallback。
3. **Hook regression**: render/switch AppShell search-radar section does not call projection summary and passes local owner ids into hydration.
4. **Regression**: existing timeout-fallback / hydration cancel tests stay green.
5. **Manual**: cross-project shared switch (user).

## Relation to cold-start change

| Concern | cold-start change | this change |
|---------|-------------------|-------------|
| first-paint vs full-catalog | ✅ | reuse modes |
| gate-ready stamp | ✅ | untouched |
| soft-ignore slot free | ✅ | keep |
| orphan body early exit | partial (late checks) | **fix** |
| navigation exhaustive projection | 未覆盖 | **移出热路径** |
| runtime switch pressure | gap #2 | **两层闭环** |
