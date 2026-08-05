## Why

Control Plane 只有在每个 DAG node 能绑定到 ordinary CLI Worker Session、获得 node-scoped context 并以 typed outcome 结算时才有工程价值。现有 Shared binding key 仅为 `engine + providerProfileId`，不能安全表达同一 target 的并行 workers，也不能把 worker turn 与 Squad node 精确关联。

## 目标与边界

- 每个 Squad node 使用 mossx-managed ordinary CLI Worker Session/Binding，并以 `runId + nodeId + attemptId` 建立 durable ownership。
- V1 采用 Parallel Analysis + Single Writer：read-only nodes 可并行；任意 workspace mutation 只能由一个 Mutate node 持有 authority。
- Context Package 只包含 node goal、approved constraints、dependency outcomes 与必要 canonical evidence。
- worker 最终结果必须映射为 `TypedOutcomeEnvelope`；raw model text 只作为 transcript/artifact，不直接控制状态机。

## What Changes

- 新增 scoped Worker Binding identity 与 durable `NodeAttemptLink`，保持 Engine/Provider/Model/Reasoning frozen target。
- 新增 event-driven DAG scheduler、ready-set calculation、bounded attempts、budget accounting 与 exact attempt dispatch。
- 新增 node-scoped Context Package compiler input/output contract。
- 新增 `Analyze`、`Mutate`、`Verify`、`Synthesize` node kinds；`Verify` 强制 read-only，失败返回 Mutate repair branch。
- 新增 structured outcome normalization、domain validation 与最多一次 bounded repair。

## 非目标

- 不实现 Worktree Executor、multi-writer merge、agent mesh 或直接 agent-to-agent transport。
- 不把 CLI native subagents 提升为独立 DAG nodes；它们是 Worker runtime 内部 opaque activity。
- 不自动执行 git commit、push、deploy，也不越过 approved workspace authority。

## 方案取舍

- 采用 **scoped Worker Binding**，不复用单一 provider binding 冒充并行。相比 Worktree Executor，V1 不引入 branch/merge lifecycle；相比串行单 Agent，可并行分析并保持 mutation safety。
- 采用 **TypedOutcomeEnvelope + shared structured-output normalizer**。相比解析 assistant prose，能 fail closed；相比新增 schema dependency，复用现有 guard/sanitize contract，减少 dependency surface。

## Capabilities

### New Capabilities

- `shared-squad-worker-execution`: Worker Binding、DAG scheduler、Context Package、typed outcome 与 adaptive budget execution contract。

### Modified Capabilities

- `shared-execution-target`: Binding identity 增加仅供 Squad Worker 使用的 scoped owner，而 immutable target 语义不变。
- `shared-context-package`: Context Package 支持 node-scoped evidence、dependency outcome 与 approved constraint manifest。
- `shared-send-pipeline`: Worker dispatch 继续遵守 durable intent before side effect、exact attempt owner 与 terminal authority contract。

## Impact

- Backend: `src-tauri/src/squad_orchestration/**`、`shared_context/**`、`shared_event_log/**`、engine dispatch adapters。
- Frontend/service: structured plan/outcome types、Tauri command mapping。
- Runtime: 会增加受预算限制的 ordinary CLI sessions，但不新增 provider runtime 类型。

## 验收标准

- 两个 read-only nodes 可并行执行；Mutate nodes 永不并行持有同一 workspace authority。
- 每个 worker event/terminal 可由 `runId + nodeId + attemptId + bindingKey` 精确归属，不使用 active tab/Picker 推断。
- model output schema mismatch 最多 repair 一次；仍失败时 node visible-failure 且不写 partial trusted state。
- Scheduler 无 polling；restart 后从 canonical facts 重建 ready/running/terminal 集合。
