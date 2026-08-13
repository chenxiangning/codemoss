## Why

Shared Session V2 当前把所有 non-idle 状态的提交统一阻断，导致 Native Session 已有的 Queue/Fusion 能力回退；同时 Codex compaction control Turn 可替换刚接收的用户 Turn，Shared terminal normalization 又会把 nested `turn.status = replaced` 误判为成功完成，最终出现空回复且压缩后不续接原请求。

这两类问题共享同一个根因：User Run、Queued Follow-up、Fusion cutover 与 Compaction 没有按 immutable `TurnExecutionSnapshot` 和 exact Binding owner 进入同一条 strictly-linear lifecycle control lane。

## 目标与边界

- 相同 `TurnExecutionSnapshot` 与 active Binding owner 下，Shared Session 允许 Queue，并在 predecessor `run:settled` 与 canonical terminal commit 后 exactly-once 投递。
- Fusion 根据 runtime-probed `input.mid-turn` capability 选择 native steer、explicit cutover 或 follow-up degradation，不伪装 unsupported 能力。
- Codex proactive compaction 与 prompt dispatch 进入同一 native thread barrier：compaction 先占 lane 时原请求等待压缩完成后继续，用户请求先占 lane 时压缩延后到 settlement。
- Claude 保留既有 prompt-overflow `/compact → retry once` 语义，但把 compaction/retry 绑定到 Shared exact owner。
- `cancel-pending`、`recovery-required` 与 ambiguous ACK 继续锁定整个 Shared Session。

## 非目标

- 不支持运行中切换 CLI、Provider、Model 或 Reasoning 后进行 Fusion。
- 不为 Kimi、OpenCode、Grok、Gemini 模拟未声明的 compaction 或 mid-turn injection。
- 不改变 Native Session canonical history，也不恢复逐 delta root reducer dispatch。
- 不引入新的第三方依赖，不执行全量测试。

## What Changes

- 复用现有 Composer queue 与 client-store persistence，冻结 `text`、`images`、`sendOptions`、Execution Target 与 predecessor Attempt identity；真实 dispatch 仍由 Shared V2 durable-first Tx1 接管。
- 将 Shared dispatch 结果贯通为 typed `accepted | queued | blocked`，队列项仅在真实 ACK/continuation evidence 后移除。
- 修正 `turn/completed` nested status normalization，区分 `completed`、`interrupted`、`failed` 与 `replaced`。
- 为 Codex auto-compaction 保存 processing 期间观察到的 high-watermark，并在 safe settlement barrier 触发。
- 将 Shared compaction lifecycle 投影回 logical Shared thread；manual compact 通过 durable Binding owner 路由，不再依赖 thread-id prefix 猜测。
- 收敛 Queue/Fusion capability degradation：`supported` 使用 native steer，`compat-input` 使用 interrupt/settle/successor cutover，`unsupported` 仅 follow-up。

## 方案比较

### Option A：仅解锁 Shared Composer 并复用 Native Queue

改动最小，但 Native queue 只持有 mutable frontend state，dispatch facade 又不能返回 Shared typed block；会在 V2 拒绝发送时提前删除队列项。拒绝。

### Option B：只修 Codex terminal/compaction

可消除空成功 Turn，但 Queue/Fusion 能力仍回退，也无法统一 Claude 与 manual compact owner routing。仅适合作为第一批原子提交，不是最终方案。

### Option C：Shared lifecycle control lane（采用）

复用现有 V2 Attempt/Binding、Queue UI 与 capability resolver，在 backend durable owner 上串行 User Run、Compaction、Retry 与 Follow-up。改动跨层，但符合基石文档的 `run:settled`、strict ordering 和 exact owner 原则。

## Capabilities

### New Capabilities

<!-- 无新增 capability；本变更收敛既有 Shared、delivery 与 compaction contracts。 -->

### Modified Capabilities

- `shared-send-pipeline`: Shared non-idle admission 从“全部阻断”改为 exact-target durable Queue，并定义 compaction/retry lifecycle。
- `composer-queued-followup-fusion`: Queue/Fusion 增加 immutable target、typed acceptance、Shared cutover 与 ambiguous-state 约束。
- `engine-message-delivery-semantics`: `compat-input` 不再被当作 native same-run steer；Shared follow-up 只在 durable settlement 后 drain。
- `codex-context-auto-compaction`: high-watermark latch、safe barrier、Shared owner continuation 与 bounded retry。
- `claude-context-compaction-recovery`: Shared exact-owner 下保留 one-shot overflow recovery。

## 验收标准

- Codex Shared 用户 Turn 与 auto-compaction 竞态时，不再产生 `completed + assistantCount=0`；若压缩先开始，原 payload 在压缩完成后首次且仅一次发送并继续生成。
- processing 期间达到阈值的 Codex usage 会在 safe barrier 触发 compaction，不丢失 high-watermark。
- Shared Queue 在相同 snapshot 下可创建；前序未 durable settle、compaction active 或 ambiguous ACK 时不得投递。
- Codex/Claude `compat-input` Fusion 必须等待 predecessor terminal 和 successor start evidence；失败时原队列项可恢复。
- unsupported CLI 不展示假 Fusion，也不调用 Codex/Claude compaction。
- focused Rust tests、focused Vitest、TypeScript typecheck、Rust formatting/check 与该 change strict validation 通过。

## Impact

- Backend：`src-tauri/src/backend/app_server_*`、`shared_runtime_coordinator.rs`、Shared V2 persistence/commands、engine capability routing。
- Frontend：Shared send state/admission、`useQueuedSend`、Shared Composer compaction projection、Tauri service mapping。
- Specs：上述五个 capability delta 与 `dev-guidelines/backend/shared-session-v2-send-contract.md` executable contract。
- Dependencies：无新增依赖；沿用 SQLite、Tokio、React state store 与现有 V2 commands。
