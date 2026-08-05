## Context

Squad 会把多个 CLI attempts 连接到同一 workspace。V1 不使用 worktree，因此 correctness 依赖三个边界：只有一个 Mutate owner、workspace scope 不越界、crash 后不把 ambiguous side effect 当成安全 retry。用户明确允许当前 workspace 最大开发权限，但未授权外部 workspace、credentials、remote write 或 deploy。

## Goals / Non-Goals

**Goals:**

- workspace-scoped durable Single Writer lease。
- dirty workspace preserving Change Fence。
- exact-owner stop/recovery，禁止 blind replay。
- forward repair 与 feature kill switch。

**Non-Goals:**

- 自动 rollback/reset/stash/checkout/commit/push/deploy。
- process-name based cleanup。
- 防止用户在 Squad 运行期间手工编辑；系统只能检测并阻断 ambiguity。

## Decisions

### 1. Workspace Mutation Lease

新增 rebuildable operational table：

```text
squad_workspace_mutation_lease(
  workspace_id PRIMARY KEY,
  session_id,
  run_id,
  node_id,
  attempt_id,
  epoch,
  state,
  acquired_at,
  updated_at
)
```

Frontend `workspaceId` 只是 app workspace UUID；Run admission 从 `AppState.workspaces` 解析并封存 canonical absolute `workspaceRoot`。lease table 的 `workspace_id` 列实际只存该 root，不接受 caller alias。Acquire 使用 single-writer transaction：CAS table row + append `SquadMutationLeaseChanged(acquired|blocked)` 同时成功或失败；Release 同理。startup 每次从 canonical lease facts deterministic rebuild operational rows。

V1 故意不做 time-based lease expiry。仅凭时间无法证明 accepted Mutate 已停止；ambiguous owner 保持 held/blocked，避免第二 writer误放行。未来若增加 reclaim，必须先加入 exact terminal + unchanged fence proof与新 epoch fact。

lease 不跨外部 command await 持有 Rust mutex/SQLite transaction；table 表达 durable ownership，短事务完成后才 dispatch。

Alternative：process-local mutex。它简单但 crash/restart 丢 owner，拒绝。

### 2. Scope Authority

Run 中封存的 `workspaceRoot` 是唯一 mutation root。每次 plan/approval/claim/outcome 都重新解析 workspace UUID并与 sealed root exact compare。所有 candidate path 必须 lexical normalize + nearest existing ancestor canonicalization后保持在 root 内；symlink escape、`..`、`.git`、credential path与 remote URL均 fail closed。

当前 workspace 内允许普通开发命令/file edits/tests；git commit/push/deploy 需要独立用户授权，本 phase 永不自动执行。

### 3. Change Fence

Mutate dispatch 前记录 `ChangeFenceBaselineV1` artifact：

- normalized workspace root
- git HEAD
- tracked dirty / staged / untracked path set
- per-path content SHA-256（不把文件正文写入 event payload）
- baseline dirty paths与整体 digest

terminal 后再次扫描，形成 `ObservedWorkspaceDeltaV1`。它只声明 observed delta，不声称完全证明 writer identity。Agent `changedPaths` 必须与 observed delta 对账：未声明或 out-of-scope change -> blocked；baseline dirty path 可继续编辑，但 before/after hash 与 delta artifact必须保留。

如果进程 crash 于 Mutate running，无法取得可信 after boundary，则 attempt=`ambiguous-side-effect`，不得重放。

### 4. Recovery Classifier

```text
prepared, no runtime link, no mutation lease -> safe to abandon/new attempt
linked, owner probe says running -> reattach observation
linked, exact terminal evidence -> settle idempotently
mutate accepted/running, terminal missing -> ambiguous-side-effect / blocked
prepared/accepted Mutate evidence missing -> keep lease and block
time elapsed alone -> never release
```

Recovery probe 必须携带 exact `runId/nodeId/attemptId/bindingKey/targetSnapshot`。owner conflict/missing identity 不回退 active tab、Picker、process name 或 provider default。

### 5. Emergency Stop

`SquadCancelRequested` 先 durable append。Scheduler 看到 cancel intent 后立即停止新 dispatch。对 projection 中 exact running owners逐一调用 existing engine interrupt adapter；interrupt result 是 evidence，不是 cancel intent authority。

- read-only/queued nodes -> Cancelled。
- active Mutate interrupt request success仍不代表 terminal ACK；V1保守 settle Blocked并保留 lease，等待 explicit recovery evidence。
- interrupt unsupported/fails -> run stays Cancelling/Blocked with diagnostic。
- duplicate Stop/terminal -> idempotent。

不自动 reverse filesystem changes。

### 6. Forward Repair

Verify failure可在 sealed target/workspace/budget内生成一次 bounded forward-repair Mutate + re-Verify branch。Change Fence/out-of-scope/ambiguous side effect直接 `SquadBranchBlocked` 并保留 evidence/lease；V1不在不可信 delta 上自动继续。任何新权限/target/workspace都 hard stop，绝不自动扩权。

### 7. Kill Switch

`squadOrchestrationV1=false`：

- reject new run/approval/dispatch；
- stop background scheduler admission；
- retain projection/history/diagnostics；
- running owners不被无提示杀死，进入 explicit stop/recovery policy。

## Risks / Trade-offs

- [filesystem observation不能绝对归因 writer] → 术语使用 observed delta；concurrent/ambiguous变化 fail closed，不自动 rollback。
- [stale lease阻塞后续 Mutate] → V1宁可 visible blocked也不按时间释放；需要 explicit exact-owner recovery。
- [non-Git workspace无可靠 delta] → Analyze/Verify可运行；Mutate在 baseline capture时 fail closed。V1 Change Fence要求 Git workspace。
- [symlink/不存在目标路径 canonicalization差异] → canonicalize nearest existing ancestor + normalized remainder，并在 actual write observation后二次验证。
- [Stop interrupt failure] → visible Cancelling/Blocked + exact diagnostics；绝不清理不明进程。

## Migration Plan

1. Additive table/index migration，重复 open idempotent。
2. startup 先 replay lease facts并核对 operational rows；冲突时 read-only recovery。
3. feature flag rollout；关闭后历史仍可读。
4. rollback 不删除 lease/fence artifacts；stale row只能经 epoch/recovery transaction收敛。

## Open Questions

无。自动 rollback 与 Worktree Executor 明确不属于 V1。
