# Design: fix-runtime-workspace-switch-main-thread-stall

## Problem model

```text
User: Project1 shared → Project2 shared
  selectWorkspace(B) + setActiveThreadId(shared:…)
  cancelWorkspaceTasks(A)  // soft-ignore: free slot, abort signal, mark generation stale
  ensure list(B) starts immediately
  orphan list(A) body STILL runs:
    titles → shared → codex pages → start multi-engine promises → merge → maybe setThreads skip
    + fire-and-forget gemini/kimi/grok that only checked requestSeq (not isStale)
  + shared history hydrate on B
  → CPU + main thread stack → 5–10s freeze
```

Cold-start gate does **not** cover this path (gate already ready).

## Approach (MVP)

### Cooperative early exit in `listThreadsForWorkspace`

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

## Test plan

1. **Unit**: mid-flight `isStale` flips true after titles → `listThreads` / `listWorkspaceSessions` / gemini not called (or not beyond injection point); no `setThreads`.
2. **Unit**: sequential cancel stack does not apply stale workspace threads.
3. **Regression**: existing timeout-fallback / hydration cancel tests stay green.
4. **Manual**: cross-project shared switch (user).

## Relation to cold-start change

| Concern | cold-start change | this change |
|---------|-------------------|-------------|
| first-paint vs full-catalog | ✅ | reuse modes |
| gate-ready stamp | ✅ | untouched |
| soft-ignore slot free | ✅ | keep |
| orphan body early exit | partial (late checks) | **fix** |
| runtime switch pressure | gap #2 | **fix** |
