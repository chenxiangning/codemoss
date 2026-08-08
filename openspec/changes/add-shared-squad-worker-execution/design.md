## Context

Control Plane 产生 approved DAG 后，需要复用现有 CLI adapters，而不是新建一种 runtime。现有 Shared binding 以 `engine + providerProfileId` 表示 continuation owner；同 target 的两个并行分析 node 不能共享同一个 native session，否则 context、terminal 与 interrupt identity 会交叉。

## Goals / Non-Goals

**Goals:**

- 每个 node attempt 有 durable scoped Worker Binding 与 immutable target。
- read-only analysis 并行，workspace mutation 串行。
- node-scoped Context Package 最小披露并保持可审计。
- typed outcome 驱动 DAG；raw transcript 不驱动状态。
- scheduler 无轮询、bounded retry、restart-safe。

**Non-Goals:**

- Worktree/branch/merge lifecycle。
- CLI native subagent 作为 first-class node。
- mid-turn reliable steer；V1 只在 attempt boundary 调度 queued follow-up。

## Decisions

### 1. Scoped Worker Binding

保留 canonical target identity：

```text
targetBindingKey = {engine}:{normalizedProviderProfileId}
workerBindingKey = squad:{runId}:{nodeId}:{targetBindingKey}
```

`workerBindingKey` 是 per-node continuation owner；retry attempt 复用同 node Binding，但每个 `attemptId` 永不复用并由 canonical facts精确关联。它不写回 Picker，不改变 `TurnExecutionSnapshot` 的 Engine/Provider/Model/Reasoning。带 `squad:` prefix 的 hidden binding/turn 继续从普通 Native list 与主 Conversation projection排除。

Alternatives:

- 复用 target binding：无法安全并行且 context 污染，拒绝。
- 每个 node 启动全新 provider process：成本高且破坏 runtime pool，拒绝；只创建 ordinary session/binding，由现有 runtime orchestrator 复用 process。

### 2. Event-Driven Scheduler

`SquadScheduler` 是 pure decision engine：输入 projection + current leases/capabilities，输出 zero or more ready node ids。command owner 先建立 scoped `TurnRequested + Binding`，再写 `SquadNodeDispatchPrepared + SquadNodeAttemptLinked`，三者全部发生在 external runtime dispatch 之前。若 crash 落在 facts 之间，projection 可从 `TurnRequested.squadRunId/nodeId/bindingKey` 恢复 exact prepared owner并 fail closed，不靠 blind replay。

```text
on planApproved/nodeTerminal/leaseChanged/cancelRequested:
  projection = rebuild_or_increment()
  ready = nodes whose deps succeeded
  candidates = ready within budget and not cancelled
  dispatch all read-only candidates
  dispatch at most one mutate candidate after lease acquired
```

不新增 `setInterval`/poll loop。runtime terminal 通过 existing authoritative coordinator 触发 next scheduling boundary。

### 3. Node Kinds and Permissions

- `Analyze`: read-only workspace/runtime queries；可并行。
- `Mutate`: current workspace file/code mutation；必须持 mutation lease + change fence。
- `Verify`: read-only command/test inspection；`permissionClass=readOnly` 强制校验。
- `Synthesize`: 消费 dependency outcomes 形成 final user answer；不直接修改 workspace。

V1 把当前 Composer resolved target 封存为 Lead target，并要求所有 Worker exact equal。Approval 前只开放 budgets / attempts 编辑，不开放 target 扩权。Codex 支持 hard read-only 与 hard current-workspace sandbox，可运行完整 DAG；Claude `permission-mode=plan` 可运行纯 read-only DAG。Kimi/Grok/OpenCode 当前 headless adapter 没有可验证的 hard read-only mode，V1 在 Lead side effect 前拒绝，不能靠 prompt 冒充权限边界。

### 4. Node-Scoped Context Package

`SquadNodeContextRequestV1`：

- node goal/kind/expected outcome
- sealed approval constraints and workspace root
- immutable target snapshot
- direct dependency `TypedOutcomeEnvelope`s
- selected canonical evidence refs
- change fence summary（Mutate/Verify only）

compiler 仍以 Canonical Log + approved artifacts 为唯一输入；不拼 hidden Native history。package manifest 明示 omitted/retrievable evidence，identity 覆盖 node/attempt/constraints/dependency hashes。

### 5. Typed Outcome Envelope

```typescript
type SquadTypedOutcomeEnvelopeV1 = {
  schemaVersion: 1;
  status: "succeeded" | "failed" | "blocked" | "cancelled";
  summary: string;
  evidence: { label: string; detail: string; path?: string | null }[];
  artifacts: string[];
  changedPaths: string[];
  verification: { status: "passed" | "failed" | "not-run"; checks: string[]; failures: string[] };
  proposedRepairs: string[];
  extra: unknown;
};
```

所有非 Synthesize raw output 先 strict JSON parse；失败时只允许一次 fence/object extraction normalization，再由 node-kind validator 缩窄。仍失败则写 visible failed outcome，并把最多 500 chars raw text仅作为 evidence。Synthesize 要求 non-empty Markdown，由 control plane包装为 typed success/failure。

`Mutate.changedPaths` 必须与 observed fence delta 对账；Agent 声称的 paths 不是 authority。

### 6. Attempts, Retry and Verification Loop

attempt identity 永不复用。Retry 只能由 scheduler 基于 sealed node budget产生：

- transport failure before acceptance：可同 target 新 attempt。
- ambiguous acceptance/side effect：blocked，禁止 blind retry。
- verification failure：创建新的 repair `Mutate` attempt 或重开原 Mutate node revision，之后重新 Verify。
- model schema failure：只允许一次 parser repair，不等价于 runtime attempt retry。

### 7. Final Synthesis

所有 required terminal nodes succeeded 后 dispatch `Synthesize`。Worker transcript 永远 nested；typed Synthesize success 后 append `SquadRunSettled(succeeded)`，Shared projector由该 settlement生成 stable id 的唯一 top-level assistant item。若 outcome 已落盘但 settlement crash，下一次 claim 会幂等补写 settlement。Synthesis empty/failure 使 run blocked，不伪造成功 answer。

## Risks / Trade-offs

- [并行 Worker 增加 provider quota/token 消耗] → sealed per-node/total budgets + capability-aware concurrency cap。
- [同 provider process 内多个 sessions 的 terminal event 可能混线] → scoped binding + exact `attemptId` owner，任何 missing/conflict fail closed。
- [model structured output 脆弱] → shared normalization、node validators、bounded repair。
- [无 mid-turn steer 降低动态性] → follow-up 只排到 next attempt boundary；V1 优先 correctness。

## Migration Plan

1. Add scoped binding metadata，不改变 legacy Shared binding read/write。
2. 先启用 Analyze/Synthesize dry run，再启用 Mutate/Verify lease path。
3. Feature flag 关闭时不 dispatch 新 workers；existing binding/facts 保持可诊断。
4. Rollback 不删除 hidden worker sessions；catalog filter 继续隐藏并允许 cleanup。

## Open Questions

无。Worktree Executor 与 multi-writer merge 延后到独立 change。
