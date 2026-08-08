# Multi-Agent Collaboration Contracts

本文件是多 CLI Agent 协作编排的 **cross-layer 可执行合同** 入口。
设计 SSOT：`docs/architecture/multi-engine-collaboration-orchestration-design.md`。
行为 SSOT：`openspec/specs/multi-agent-orchestration/spec.md`。

## Scope / Trigger

- Trigger：修改 `src-tauri/src/agent_orchestration/**`、`src/features/multi-agent/**`、
  Shared Runtime Context 协作 outcome 投影、Inspector 幕布 key、stage outcome 截断。
- 目标：常量、展示契约、降级 settle 有单一事实源；改值必须双侧（代码 + 本 contract）同步。

## 1. Outcome 字符上限常量

| 常量 | 值 | 所属层 | 消费方 | 变更影响面 |
| --- | --- | --- | --- | --- |
| `STAGE_SHORT_OUTCOME_CHARS` | `160` | Rust control plane | stage chip / `shortOutcome` / outcome.summary | 主时间线 chip、阶段表「要点」列、失败 note |
| `STAGE_OUTCOME_BODY_CHARS` | `12_000` | Rust control plane | outcome.body（Runtime Context / 右栏全文） | 跨轮 Context 体积、Inspector 正文上限 |
| `FINAL_SUMMARY_CHARS` | `12_000` | Rust control plane | `finalSummary` / `compose_orchestration_summary` | 主幕调度汇总框（**无** `…` 省略号） |

### Signatures

```rust
// src-tauri/src/agent_orchestration/types.rs
pub const STAGE_SHORT_OUTCOME_CHARS: usize = 160;
pub const STAGE_OUTCOME_BODY_CHARS: usize = 12_000;
pub const FINAL_SUMMARY_CHARS: usize = 12_000;

pub fn short_text(raw: &str, max_chars: usize) -> String; // 超长加 …
pub fn cap_text(raw: &str, max_chars: usize) -> String;   // 超长硬截，无 …
```

### Contracts

- `shortOutcome` / chip 文案 MUST 走 `short_text(..., STAGE_SHORT_OUTCOME_CHARS)`。
- `outcome.body` MUST 走 `cap_text(..., STAGE_OUTCOME_BODY_CHARS)`。
- `finalSummary` MUST 走 `cap_text(..., FINAL_SUMMARY_CHARS)`，禁止用带 `…` 的 short_text。
- 前端当前不重复定义这三项；若未来镜像常量，MUST 与本表一致并回写本文件。

## 2. Display contracts（§17.4.3）

### Contract 1 — 徽章对齐 stage.target

- Inspector 幕布 assistant 项的 `executionTargetSnapshot` MUST 对齐当前
  `stage.target`（`alignItemsToStageTarget`）。
- 禁止用跨 attempt 脏 snapshot 冒充本段引擎/供应商。

### Contract 2 — plan 阶段专用 plan.markdown

- **仅** `stage.id === "plan"` 时，fallback 正文 MAY 读取 `projection.plan.markdown`。
- implement / review / 其它 stage MUST NOT 用 `plan.markdown` 回填（串台根因）。
- 代码：`buildStageOwnedFallback` in `useAgentStageTranscript.ts`。
- 测试：`useAgentStageTranscript.test.ts`（contract 2 用例名必须带编号）。

### Contract 3 — canvas 对账 key 形状

- 协作节点 canvas threadId MUST 为
  `agent-canvas:{sharedThreadId}:{attemptId}`，其中 `sharedThreadId` 以 `shared:` 开头。
- 解析 MUST 经 `parseAgentCanvasThreadId` 还原 `sharedThreadId` + `attemptId`。
- 主幕 `useAppServerEvents` 仍以事件自带 `threadId` 为 key（含 `shared:` / engine 前缀 / agent-canvas:）；
  **协作 Inspector 不得**用裸 uuid 或主幕 `shared:` 时间线切片代替 attempt-scoped canvas key。
- 代码：`agentCanvasThread.ts`、`useAgentStageTranscript`。

### Contract 4 — persona 展示 + 注入

- 卡片头副标题：`stageInspectorTypeLine(stage)` =
  `stageTargetLabel(stage)` + 可选 ` · 智能体 {personaAgentName}`。
- 幕布 / Inspector **只展示** icon + name；**禁止**渲染 `personaPrompt` / 智能体正文。
- 执行叠层（CLI）：`personaPrompt`（有则）→ `rolePrompt` 本步指令（有则）→ 环节基座 prompt。
  - 前端：`templateToStageBindings` 分字段发送 `personaPrompt` 与 `rolePrompt`。
  - Rust：`with_persona_and_role_prompt` + `build_stage_prompt`。
- persona 不得改写 `stage.target` 或 bindingKey。
- 绑定字段：`personaAgentId` / `Name` / `Icon`（展示）+ `personaPrompt`（执行快照）。

### Contract 5 — Composer 上下文首段对齐（Context Fan-in）

- 图 / skill / 记忆 / 便签（可多条）**只进** `stages[0]` worker turn。
- 后续段 MUST NOT 再挂 `images` 或重注入记忆/便签/skill 原件；只吃 `plan` + `short_outcome` 文本接力。
- 入口 MUST NOT 再因附件/上下文整类拒绝协作发送（废除旧 V1 附件/context gate）。
- `shared_agent_request_run` MAY 接受 `images`；MUST 写入 run extra `firstStageImages`；首段 `begin_squad_worker_turn` MUST 填 `image_refs`。
- **Dispatch 附图 SSOT**：`shared_session_v2_dispatch_turn` 在调用方未传 `images` 时，MUST 从 durable `TurnRequested.input.image_refs[].locator` 回填，再交给 CLI。协作 `driveAttempt` 只带 attemptId，依赖此回填。
- **纯图**：允许 `text` 为空且 `images` 非空；首段用占位任务文案「（请根据附图回答）」；禁止静默丢图。
- **记忆 / 便签正文**：发送链路 MUST 在 `requestAgentPlan.text`（model text）中注入 retrieval pack / note-card-context；通道与普通 Shared 相同（text 进 `TurnRequested.input.text`），**不是** image_refs 类旁路。
- **Skill 正文**：协作 MUST 按 `skillInvocations[].path` 读 SKILL.md 并注入首段 model text（`【技能上下文】`）；不得仅依赖埋在编排 prompt 中间的 `/slash` 解析。读失败时 MAY 保留 slash 作引擎回退。
- **后续段用户任务**：用 `userVisibleText`（主幕可见原文），禁止把记忆/skill/便签注入块再塞给 implement/review。
- 主幕用户气泡 MUST 用 visible text + 首段附图缩略图，禁止把注入块当用户原文展示。
- 设计 SSOT：`docs/architecture/multi-engine-collaboration-orchestration-design.md` §8.6。

## 3. 降级 settle（§11）

- 当 **非首段**（`completed_stage_index > 0`）已成功结算、启动下一段失败时：
  - run MUST settle 为 `succeeded`（非 `failed`）。
  - 后续未跑段标记 `skipped`。
  - `finalSummary` MUST 走 `compose_orchestration_summary`，保留已成功段短说明（含 implement）。
- 首段启动失败仍走 `append_failed_and_settle` → `failed`。
- 代码：`commands.rs` `should_degrade_settle_on_next_start_failure` +
  next-stage start `Err` 分支。

## Validation

```bash
# 前端契约测
npx vitest run \
  src/features/multi-agent/hooks/useAgentStageTranscript.test.ts \
  src/features/multi-agent/utils/format.test.ts \
  src/features/multi-agent/runtime/agentCanvasThread.test.ts

# Rust 常量 / 降级 / 汇总
cargo test --manifest-path src-tauri/Cargo.toml \
  --lib agent_orchestration
```

## DoD

- [ ] 改常量值时同步本表 + openspec scenario + `types.rs` 定义。
- [ ] contract 2/3/4 与降级 settle 有自动化断言且测试名带 contract / § 编号。
- [ ] 无第二套「魔术数字」散落在前端。
