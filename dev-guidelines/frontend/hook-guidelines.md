# Hook Guidelines（Hook 开发规范）

## Hook Contract

- 命名必须 `useXxx`。
- hook 负责 orchestration + side effects，component 负责 rendering。
- 纯计算逻辑放 `utils`，不要滥用 hook 包装纯函数。

## Scenario: Hook 调用 runtime / bridge

### 1. Scope / Trigger

- Trigger：修改 `src/features/**/hooks/*` 且会调用 `src/services/tauri.ts`、`src/services/events.ts`、polling 或 listener。
- 这类变更属于 cross-layer behavior，必须明确 cleanup、fallback、race handling。

### 2. Signatures

- Hook 对 component 暴露 stable contract：`state + actions + status`。
- frontend -> runtime command 统一经 `src/services/tauri.ts`，不要在 hook 内直接 `invoke()`。
- 事件订阅返回的 `unlisten` / cleanup handler 必须在 `useEffect` cleanup 中释放。

### 3. Contracts

- hook 内部可以持有 `loading/error/data`，但 raw runtime payload 进入 UI 前必须先 normalize / map。
- error state 要是 user-readable message，不直接把 `unknown` 或 backend raw object 塞进 JSX。
- 若当前运行环境可能没有 Tauri bridge，必须走 existing fallback contract，不能让组件崩掉。

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| effect 重跑 | 先 cleanup 上一轮 timer/listener/request guard | 叠加多个 listener |
| async 返回乱序 | 忽略 stale response 或使用 request token/ref | 后返回覆盖新状态 |
| runtime 不可用 | 使用已有 fallback / empty state | 直接 throw 到 render |
| error 捕获 | normalize 成 string/message | silent catch |

### 5. Good / Base / Bad Cases

- Good：hook 只编排状态与副作用，payload mapping 放 service / adapter。
- Base：小型 hook 可在 hook 内做轻量 normalize，但 contract 仍需稳定。
- Bad：hook 里直接 `invoke()`、直接读写 DOM/global、effect 无 cleanup。

### 6. Tests Required

- happy path：返回成功状态，component 可消费。
- error path：service reject / missing bridge 时 UI 不崩。
- edge case：重复触发、快速切换、重复 mount/unmount。
- 若 hook 包含 polling/listener，测试必须断言 cleanup 被调用。

### 7. Wrong vs Correct

#### Wrong

```tsx
useEffect(() => {
  invoke("list_workspaces").then(setItems);
}, []);
```

#### Correct

```tsx
useEffect(() => {
  let cancelled = false;

  listWorkspaces()
    .then((items) => {
      if (!cancelled) {
        setItems(items);
      }
    })
    .catch((error) => {
      if (!cancelled) {
        setError(error instanceof Error ? error.message : String(error));
      }
    });

  return () => {
    cancelled = true;
  };
}, []);
```

## Async & Concurrency 规范

- 轮询/并发请求要防 stale response（request id ref / cancel flag）。
- `useEffect` 里 timer/listener 必须 cleanup。
- polling 需要 mode-aware（active/background/paused）时，间隔策略必须显式。

## Bridge 调用规范

- frontend -> runtime 的 command 调用统一经过 `src/services/tauri.ts`。
- feature hook/component 禁止直接 `invoke()`（除非明确 boundary exception）。
- 事件订阅优先使用 `src/services/events.ts` 封装，避免散落 unlisten 逻辑。

## State/Ref 规范

- `useRef` 用于 in-flight、latest snapshot、debounce guard。
- `useMemo` 只用于 expensive derive 或 contract-stable 值，不做装饰性 memo。
- hook state shape 需要显式类型，避免匿名 object 漂移。

## Error Handling

- 禁止 silent catch。
- `unknown` error 必须 normalize 成可读 message。
- 失败场景优先回退到缓存或 safe state，避免 UI 崩断。

## Scenario: Thread History One-Shot Recovery And Scoped Generation

### 1. Scope / Trigger

- Trigger：修改 `useThreads.setActiveThreadId`、`useThreadActionsResumeThread.resumeThreadForWorkspace`、history lazy resume 或显式 `refreshThread`。
- 目标：一次自动恢复失败后，切走再切回不得形成无限 retry；同一 thread 的旧 async response 不得覆盖较新的 retry。

### 2. Signatures

- Selection action：`setActiveThreadId(threadId: string | null, workspaceId?: string): void`
- Resume action：`resumeThreadForWorkspace(workspaceId, threadId, force?, replaceLocal?, options?): Promise<string | null>`
- Explicit retry：`refreshThread(workspaceId: string, threadId: string): Promise<string | null>`
- Request identity：`workspaceId + "\0" + canonicalThreadId + generation`

### 3. Contracts

- selection-driven lazy resume MUST consult the latest `historyLoadingByThreadId`; state 为 `failed` 时不得再次自动请求。
- explicit `refreshThread` MUST remain retryable；成功后必须清除 `failed` 并发布已加载 history。
- 每个 `workspaceId + canonicalThreadId` MUST maintain an independent monotonic generation；A thread 的请求不得使 B thread 的请求失效。
- 每个 async boundary 返回后都必须确认 generation 仍是 current；stale request 不得 dispatch items、loaded、failed、active-thread replacement 或 recovery state。
- canonical alias MUST be resolved before selection/retry scope is created，避免 old id/new id 各自拥有一套自动恢复预算。

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| 首次自动恢复失败 | 标记 `failed`，结束 loading | 留下 loading residue |
| A → B → A，A 已失败 | 只选择 A，不自动再次请求 | 每次重选都重放失败请求 |
| 用户显式刷新 A | 发起新 generation；成功后清失败态 | 因自动恢复预算耗尽而拒绝人工 retry |
| A 的旧请求晚于 A 的新请求返回 | 丢弃旧请求全部写入 | 旧 response 覆盖新 history |
| A/B 并发恢复 | 各自按 scope 收敛 | 用一个 global request id 互相取消 |

### 5. Good / Base / Bad Cases

- Good：selection 自动恢复是 one-shot；按钮触发的 explicit refresh 可重试；generation 按 workspace/thread 隔离。
- Base：已加载且超过 refresh interval 的 thread 可按既有策略后台刷新，但仍受 scoped generation 保护。
- Bad：只用 `loadedThreadsRef` 判断失败；失败 thread 重选时会不断访问 backend。

### 6. Tests Required

- `useThreads.sidebar-cache.test.tsx` MUST cover 自动恢复失败后切走/切回不再请求，以及 explicit refresh 仍能成功。
- `useThreadActions.test.tsx` MUST cover 同一 workspace/thread 两个乱序请求中旧 response 不产生任何 state write。
- Alias behavior 变化时 MUST add old id → canonical id 的 shared-budget assertion。

### 7. Wrong vs Correct

#### Wrong

```typescript
if (!loadedThreadsRef.current[threadId]) {
  void resumeThreadForWorkspace(workspaceId, threadId);
}
```

#### Correct

```typescript
const canonicalThreadId = resolveCanonicalThreadId(threadId);
const recoveryFailed =
  historyLoadingStateByThreadRef.current[canonicalThreadId] === "failed";
if (!loadedThreadsRef.current[canonicalThreadId] && !recoveryFailed) {
  void resumeThreadForWorkspace(workspaceId, canonicalThreadId);
}
```

## Scenario: Codex First-Turn Draft Recovery Hooks

### 1. Scope / Trigger

- Trigger：修改 `useThreadMessaging`、Codex stale-thread recovery、`canUseLocalFirstSendCodexDraftReplacement` 或 thread refresh/fork fallback 顺序。
- 目标：区分 disposable first-turn draft 和 durable stale conversation，避免把空白首轮 draft 拖进手动恢复卡。

### 2. Contracts

- `thread not found` / `session not found` 进入 Codex recovery 时，必须先尝试 verified refresh/rebind。
- 当 accepted-turn / durable-activity facts 证明当前 thread 是 `local-first-send-draft` disposable first-turn draft，且本地有当前 optimistic user intent 时，fresh Codex thread replay MAY happen before stale fork fallback。
- Native `thread-start` empty draft 已经是 Codex provider/runtime 返回的 thread identity，MUST NOT 被 silent fresh replay 或 fork continuation 自动替换；必须走 bounded readiness、verified rebind、explicit continuation 或 visible failure。
- Unknown native `thread not found` failure 在无法证明是当前 local disposable draft 时，MUST NOT silent fresh replace。
- 对 first-turn missing-thread draft，`refreshThread` 返回原 `threadId` MUST NOT be treated as verified rebind；它表示 same-id recovery 未产生可验证 replacement，必须进入 fresh replay 或继续显式失败语义。
- durable activity 存在、accepted turn 已成立、或无法证明是当前 first-send empty draft 时，MUST NOT silent fresh replace；继续使用 verified rebind、fork 或显式用户恢复语义。
- fresh replay MUST be single-shot：retry 请求必须携带 `codexInvalidThreadRetryAttempted`，重复失败后进入可见错误/恢复状态，不能循环创建 fresh thread。

### 3. Tests Required

- 覆盖 local-first-send-draft `thread not found` 在 refresh 无法 rebind 时可 single-shot fresh replay，且不调用 fork。
- 覆盖新会话 native `thread-start` empty-draft `thread not found` 且 refresh 返回 same `threadId` 时不得创建第二个 fresh thread，不能 retry 同一个 missing thread。
- 覆盖 durable stale thread 不 silent fresh replacement，仍走 rebind/fork 或错误展示。
- 覆盖 lost/unknown empty-draft marker 即使本地无 durable activity且有当前 optimistic user intent，也不得 silent fresh replay，除非 accepted-turn source 明确是 local disposable draft。

## Scenario: One-Shot Composer Command And User-Input Settlement Hooks

### 1. Scope / Trigger

- Trigger：修改 composer slash command selection/send flow、`useThreadUserInput`、AskUserQuestion dialog settlement、custom command helpers。
- 目标：保证 one-shot command state 不污染后续发送，并让 stale timeout settlement 释放 pending UI。

### 2. Signatures

- Slash/custom command state:
  - selected command identity
  - inserted command text
  - current plain draft text
- AskUserQuestion stale timeout classifier:
  - only applies to already-settled timeout/cancel response
  - ordinary submit failures remain retryable

### 3. Contracts

- Custom slash command residue MUST be cleared before the next unrelated send.
- Early cleanup MUST NOT delete current plain draft text.
- Failed send retry MUST NOT reapply an already-consumed command unless the user explicitly selects it again.
- AskUserQuestion stale timeout/cancel response MUST remove pending request and optimistic processing residue.
- Non-stale submit failures MUST leave request visible for retry.

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| send after custom command | next plain send has no previous command residue | previous slash command prepended again |
| command cleanup before send | user draft remains intact | cleanup wipes user text |
| backend already timed out AskUserQuestion | pending dialog closes | dialog remains stuck |
| bridge submit failure | request remains retryable | request silently disappears |

### 5. Tests Required

- Composer tests for command residue not leaking into subsequent sends.
- Hook tests for stale timeout/cancel settlement.
- Hook tests for ordinary submit failure preserving pending request.

## Scenario: Workspace File Tree Refresh Invalidation

### 1. Scope / Trigger

- Trigger：修改 `src/features/workspaces/hooks/useWorkspaceFiles.ts`、`src/features/files/components/FileTreePanel.tsx`、`src/services/tauri/workspaceFiles.ts`、`list_workspace_files` 或 `list_workspace_directory_children`。
- 目标：手动刷新必须获取磁盘最新事实，不能被 frontend lazy subtree cache 或 backend listing cache 挡住。

### 2. Signatures

- Service:
  - `getWorkspaceFiles(workspaceId: string, options?: { forceRefresh?: boolean })`
  - `getWorkspaceDirectoryChildren(workspaceId: string, path: string, options?: { forceRefresh?: boolean })`
- Tauri commands:
  - `list_workspace_files(workspace_id: String, force_refresh: Option<bool>)`
  - `list_workspace_directory_children(workspace_id: String, path: String, force_refresh: Option<bool>)`
- UI action:
  - manual refresh button MUST call a local invalidation action before invoking `refreshFiles("manual")`.

### 3. Contracts

- Initial load and polling SHOULD pass `forceRefresh: false` to preserve listing-budget cache behavior.
- Manual refresh MUST pass `forceRefresh: true` and backend MUST invalidate the matching listing cache key before scanning.
- `FileTreePanel` MUST clear `lazyFiles` / `lazyDirectories` / `loadedLazyDirectories` / lazy metadata before manual refresh, so expanded lazy directories can refetch children.
- Successful create/copy/paste/rename operations SHOULD optimistically reveal the affected path, then trigger refresh for backend truth reconciliation.
- Delete/trash operations MUST purge the deleted subtree locally and then refresh.
- Detached file explorer MUST receive the same `sourceVersion` / refresh behavior as the main file tree.

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| 手动点击刷新 | clear frontend lazy cache + `forceRefresh: true` | 只重放 cached request |
| 外部磁盘新增文件 | 刷新后 expanded lazy directory 重新请求 children | `loadedLazyDirectories` 阻止重新加载 |
| 前端新建文件/文件夹 | 新路径立即出现在树中并后台校准 | 等轮询或旧 cache，导致操作成功但 UI 不变 |
| rename/paste/duplicate | 选择并 reveal 返回的 `result.path` | 只刷新 root，忽略当前 subtree |
| backend cache 命中 | manual refresh 先 invalidate cache key | 返回 stale `ScanCacheState::Hit` 响应 |
| remote daemon mode | `forceRefresh` 字段透传 daemon RPC | 桌面模式有效、remote mode 无效 |

### 5. Good / Base / Bad Cases

- Good：刷新按钮调用 `refreshFileTree()`，先清 lazy subtree cache，再由 `useWorkspaceFiles.refreshFiles("manual")` 传 `forceRefresh: true`。
- Base：polling 调用继续使用 `forceRefresh: false`，避免大 workspace 失去 cache 保护。
- Bad：只在 `useWorkspaceFiles` 重新请求 root children，但不清 `FileTreePanel` 的 lazy directory cache。

### 6. Tests Required

- Vitest：`useWorkspaceFiles` manual refresh asserts `getWorkspaceDirectoryChildren(workspaceId, "", { forceRefresh: true })`。
- Vitest：`FileTreePanel` manual refresh clears loaded lazy directories and refetches expanded lazy children.
- Rust：`list_workspace_files_inner_with_refresh(..., true)` 和 `list_workspace_directory_children_inner_with_refresh(..., true)` bypass cached signature and include newly created disk entries.
- Contract gate：run `npm run check:runtime-contracts` after changing service / command payload fields.

### 7. Wrong vs Correct

#### Wrong

```typescript
onClick={() => onRefreshFiles?.()}
```

#### Correct

```typescript
const refreshFileTree = () => {
  clearLazyDirectoryCache();
  onRefreshFiles?.();
};
```

#### Wrong

```rust
list_workspace_directory_children_inner(&root, &path, MAX_WORKSPACE_DIRECTORY_CHILDREN)
```

#### Correct

```rust
list_workspace_directory_children_inner_with_refresh(
    &root,
    &path,
    MAX_WORKSPACE_DIRECTORY_CHILDREN,
    force_refresh.unwrap_or(false),
)
```

## Scenario: Repository Summary Stability And Explicit Branch Mutation Scope

### 1. Scope / Trigger

- Trigger：修改 `useGitRepositories`、`useGitBranches`、repository-scoped Git menu/action wiring，或任何 aggregate polling 会驱动 detail hook mount/unmount 的链路。
- 目标：单次 transient empty response 不得擦除 last-known-good projection；write action 不得通过先切换 persisted selection 来推断 target。

### 2. Signatures

- Summary owner：`useGitRepositories(...).refreshRepositories(): Promise<void>`。
- Scoped update：`updateBranch(name: string, repositoryRootOverride?: string): Promise<GitBranchUpdateResult | null>`。
- UI intent：

```typescript
type GitRepositoryActionRequest =
  | { action: "update"; repositoryRoot: string; branchName: string }
  | { action: Exclude<GitRepositoryActionId, "update">; repositoryRoot: string };
```

### 3. Contracts

- Aggregate owner MUST reject one empty normalized sample when the same connected workspace has a non-empty last-known-good collection；连续 confirmed empty MAY converge to `[]`。
- Empty-sample counter/ref MUST be updated outside React state updater；state updater MUST remain pure under StrictMode double invocation。
- Workspace identity change或 disconnected state MUST clear accepted snapshot、empty counter、selection 与 dependent detail state。
- Repository write action MUST carry explicit `repositoryRoot` and required domain identity（Update 包含 `branchName`）。
- Explicit root `""` MUST continue to mean workspace root；不得用 `||` 把它退化成 configured-root fallback。
- Pending mutation dedupe key MUST include workspace identity、repository root 与 branch identity；success/no-op/blocked/error MUST settle visible feedback。

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| valid summaries → one empty poll | 保留 accepted summaries 与 branch hook scope | 清 selection 导致 branch rows 闪空 |
| two confirmed empty polls | 允许收敛为空 | 永久缓存已删除 repository |
| workspace switch/disconnect | 清 snapshot/counter/pending scope | 复用前一 workspace state |
| nested repository Update | `updateGitBranch(workspaceId, branchName, repositoryRoot)` | 先改 persisted `gitRoot` 再用 stale closure 更新 |
| root repository Update | 显式传 `repositoryRoot=""` | 把空字符串当 missing scope |
| duplicate pending Update | dedupe 且最终反馈只由原请求结算 | 并发执行相同 mutation |

### 5. Good / Base / Bad Cases

- Good：aggregate response 在 state updater 外决定 `accepted` snapshot，setter 只比较并发布该 snapshot。
- Good：FileTree intent 同时携带 `repositoryRoot` 与 summary `currentBranch`，hook override 原样进入 service。
- Base：不传 `repositoryRootOverride` 的 Composer Update 继续使用 hook 当前 selected repository。
- Bad：在 `setRepositories(current => { emptyCountRef.current += 1; ... })` 中修改 ref；StrictMode 可能把一个 response 计为两次。
- Bad：`await selectGitRoot(root); await updateBranch(branch)`；React state/closure 尚未收敛时可能更新旧 repository。

### 6. Tests Required

- `useGitRepositories.test.tsx` MUST cover valid → one empty retained → second empty accepted，以及 workspace switch stale-response rejection。
- repository action test MUST assert `{ action: "update", repositoryRoot, branchName }` exact payload。
- AppShell hook test MUST assert explicit root reaches `updateBranch(name, root)`、duplicate pending request is suppressed、error feedback settles。
- FileTree test MUST assert detached/unborn/unavailable/no-current-branch Update is disabled。
- 修改 service/command mapping 时追加 `npm run check:runtime-contracts`；只复用既有 mapping 时仍需运行该 gate。

### 7. Wrong vs Correct

#### Wrong

```typescript
setRepositories((current) => {
  emptyCountRef.current += 1;
  return response.length === 0 ? [] : response;
});

await selectGitRoot(repositoryRoot);
await updateBranch(branchName);
```

#### Correct

```typescript
const current = acceptedRepositoriesRef.current;
const accepted = normalized.length === 0 && current.length > 0
  ? current
  : normalized;
acceptedRepositoriesRef.current = accepted;
setRepositories((rendered) =>
  areGitRepositorySummariesEqual(rendered, accepted) ? rendered : accepted,
);

await updateBranch(branchName, repositoryRoot);
```

## Testing 要求

- 非 trivial hook 至少覆盖：
  - happy path
  - error path
  - edge case（空值、race、重复触发）
- 测试中 mock `services/tauri`，不要直接 patch 全局 runtime。

## Realtime Dispatch Decision Matrix

### 1. Scope / Trigger

- Trigger：修改 `src/features/threads/hooks/useThreadItemEvents.ts`、`src/features/threads/contracts/realtimeEventBatcher.ts` 或新增 normalized realtime operation。
- 目标：把流式事件明确路由到 batch aggregator、contract batcher 或 urgent dispatch，避免首 token 可见性与高频 reducer 压力互相污染。

### 2. Contracts

| Operation / Flush reason | Dispatch channel | `useTransitionForDispatch` |
|---|---|---|
| `appendAgentMessageDelta` / any reason | urgent dispatch | `false` |
| `appendReasoningContentDelta` / `first-token` | urgent dispatch | `false` |
| `appendReasoningContentDelta` / non-`first-token` | batch aggregator | `true` unless terminal |
| `appendReasoningSummaryDelta` | batch aggregator | `true` unless terminal |
| `appendToolOutputDelta` | batch aggregator | `true` unless terminal |
| assistant `itemStarted` / `itemUpdated` snapshot | normalized latest-frame buffer | `false` at flush |

### 3. Predicate Rules

- `shouldBatchNormalizedRealtimeEvent`、`shouldUseContractRealtimeBatcher`、`shouldDispatchNormalizedRealtimeEventUrgently` 与 `shouldUrgentlyDispatchReasoningDelta` MUST remain pure.
- These predicates MUST NOT read React state, refs, localStorage, timers, network, or current time.
- First-token urgency MUST be keyed by `RealtimeBatcherFlushReason === "first-token"`; do not infer it from delta text length.

### 4. Tests Required

- Add or update hook tests when a normalized operation changes dispatch channel.
- Reasoning content streaming MUST cover both:
  - first-token reasoning delta dispatches without a queued transition
  - steady-state reasoning delta remains batched after cadence flush

## Scenario: Effect-Owned Runtime Watcher Lease

### 1. Scope / Trigger

- Trigger：React hook 通过 async Tauri `start` / `stop` commands 拥有 backend watcher、listener task 或长生命周期 runtime resource。
- 目标：cleanup 不得越过 pending start；StrictMode/remount 的 overlapping owners 不得互相误停。

### 2. Signatures

- Frontend owner：`useCustomCommands` 的 `startClaudeCommandsWatch(workspaceId)` / `stopClaudeCommandsWatch(workspaceId)`。
- Backend owner：`claude_commands_watch_start(workspace_id)` / `claude_commands_watch_stop(workspace_id)`。
- Registry identity：normalized `workspaceId | "global"` + one watcher handle + `leases: usize`。

### 3. Contracts

- Effect MUST 保存 `startPromise`；cleanup MUST 在该 promise 成功 settle 后调用 matching stop。
- Start 失败时 cleanup MUST NOT 发送无对应 lease 的 stop。
- Backend duplicate start MUST acquire one additional lease，不得创建第二个 watcher。
- Stop MUST release exactly one lease；只有 lease count 归零时才 abort/remove handle。
- 首次 missing check、watcher create 与 registry insert MUST 位于同一 lifecycle critical section。

### 4. Validation & Error Matrix

| 时序 | 必须行为 | 禁止行为 |
|---|---|---|
| start pending → unmount | start settle 后 stop | stop 先返回、start 后插入失管 handle |
| StrictMode start₁ → start₂ → stop₁ | lease `2 → 1`，watcher 存活 | stop₁ 直接 remove 第二个 owner |
| final stop₂ | lease `1 → 0`，abort/remove | watcher 永久残留 |
| start reject → cleanup | 记录 start error，不 stop | release 不存在的 lease |

### 5. Good / Base / Bad Cases

- Good：effect cleanup 串在自己的 `startPromise.then(...)` 后；Rust registry 以 lease count 表达 overlapping ownership。
- Base：单 owner mount/unmount 为 `0 → 1 → 0`。
- Bad：fire-and-forget `start()`，cleanup 立即 fire-and-forget `stop()`；IPC completion order 可反转。

### 6. Tests Required

- Hook test MUST 使用 pending start promise，断言 unmount 前 stop 未调用、resolve 后 stop 精确调用一次。
- Rust registry test MUST 覆盖 duplicate acquire 为 2、第一次 release 保留 1、第二次 release 清零。
- Focused gate：`npx vitest run src/features/commands/hooks/useCustomCommands.test.tsx` 与 `cargo test --manifest-path src-tauri/Cargo.toml claude_commands_watch --lib`。

### 7. Wrong vs Correct

#### Wrong

```typescript
startWatcher(scope);
return () => stopWatcher(scope);
```

#### Correct

```typescript
const startPromise = startWatcher(scope);
return () => {
  void startPromise.then(() => stopWatcher(scope)).catch(() => {});
};
```
