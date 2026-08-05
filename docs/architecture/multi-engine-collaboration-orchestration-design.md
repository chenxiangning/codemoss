# 多引擎协作编排设计（Multi-Engine Collaboration Orchestration）

| 字段 | 值 |
|------|-----|
| 状态 | design / active |
| 日期 | 2026-08-05 |
| 范围 | Shared Session 内的多 CLI · Provider · Model 分环节协作 |
| 产品入口 | Composer「协作」/ Multi-Agent Collab |
| 非范围 | 引擎原生 Task 子代理 first-class 化；自由 Agent Mesh；Worktree 多写合并 |

---

## 1. 背景与问题

### 1.1 产品语境

mossx（CCGUI）已具备：

- **Shared Session**：跨引擎统一对话与 durable event log
- **Execution Target**：`engine + providerProfile + model + reasoning` 的可冻结快照
- **Scoped Worker Binding**：`squad:{runId}:{stageId}:{engine}:{provider}` 隔离 attempt owner
- **Realtime 隔离**：worker 正文可不进主 Messages 根链，避免 jank

用户真正要的「多 Agent 协作」不是「同一个模型跑三段」，而是：

> 在一条 Shared 会话里，**不同环节使用不同的 CLI + 供应商 + 模型**接手工作；  
> **主幕布体现组合与编排**；**节点分屏实时展示**；**结束后主幕布短汇总**。

### 1.2 历史误区（必须对齐）

| 误区 | 表现 | 正确方向 |
|------|------|----------|
| 单 target 流水线 | 全 run 封印 Composer 当前 target | 每 stage 独立 target |
| 假 DAG 调度器 | 强 JSON DAG + Mutate 仅 Codex 死锁 | 先串行环节编排，主路径可跑通 |
| 主幕刷全文 | 完成页 dump 半屏分析 | 主幕 = 编排；正文 = 节点 |
| 与原生子代理混淆 | 右侧变 Claude Task 网格 | 协作 Inspector 优先于原生子代理 |
| 直播串字 | 累计快照当 delta append | merge 识别 snapshot vs delta |

### 1.3 设计目标

1. **组合可配置**：环节可绑不同引擎与供应商。
2. **编排可见**：主幕布一眼看懂「谁在干哪一段、状态如何」。
3. **节点可观测**：选中环节 → 右侧直播该 attempt。
4. **结束可收口**：短汇总进入主对话，不污染编排卡。
5. **权威可证明**：状态机以 Canonical Fact / Projection 为准，不靠 prose 驱动。
6. **失败可见**：诊断进 projection，UI 必显。

### 1.4 非目标（V1）

- 自由 DAG / 并行多写者 / worktree merge
- 自动「最强模型路由」
- 把引擎原生 SubAgent（Task 工具）升级为协作节点
- 跨 workspace、远程 deploy、自动 git commit/push

---

## 2. 产品定义

### 2.1 一句话

**Multi-Engine Collaboration** 是 Shared Session 上的 **串行多引擎管线**：用户（或默认模板）定义有序 **Stage**，每个 Stage 绑定一个 **Execution Target**，由 mossx control plane 调度 ordinary CLI worker turn，主 UI 展示编排，分屏展示节点直播。

### 2.2 角色分工

| 角色 | 职责 |
|------|------|
| **用户** | 发起任务、配置各段 target、确认规划（默认门闩）、停止 |
| **Control Plane（mossx）** | 准入、串行调度、attempt owner、投影、取消、短汇总落盘 |
| **Stage Worker** | 某一 CLI runtime 上的一次 ordinary turn（规划 / 实现 / 审查） |
| **主幕布** | 编排时间线 + 确认/停止 + 完成短汇总入口 |
| **右侧 Inspector** | 当前选中 stage 的实时输出 |

### 2.3 V1 固定管线（默认模板）

| Stage ID | 标题 | 默认权限 | 默认职责 |
|----------|------|----------|----------|
| `plan` | 规划 | `read-only`（Codex/Claude 优先） | 产出可确认计划，不改仓库 |
| `implement` | 实现 | `current` | 按计划改代码/完成任务 |
| `review` | 审查 | `read-only` 优先 | 检查 + **生成短汇总** |

**默认绑定**：若用户未逐段配置，三段均继承当前 Shared Session target。  
**结构上**始终携带 `stageBindings[]`，保证后续「每段不同 CLI」零契约破坏。

### 2.4 主路径（Happy Path）

```text
用户 arm 协作 → 发送任务
  → RunRequested（含 stageBindings）
  → Stage plan running  → 右侧直播 plan
  → Plan 产出 → AwaitingApproval
  → 用户确认
  → Stage implement running → 右侧直播 implement
  → Stage review running → 右侧直播 review
  → RunSucceeded + finalSummary（短）
  → 主对话投影用户请求 + 短汇总
```

### 2.5 主幕布 vs 分屏（硬规则）

| 区域 | 必须展示 | 禁止展示 |
|------|----------|----------|
| 主幕布协作卡 | 请求摘要、各 stage 卡、CLI·model 徽章、stage 状态、一行 shortOutcome、确认/停止 | 节点全文流、工具瀑布、半屏 dump |
| 右侧节点直播 | 选中 stage 的实时文本（及后续工具轨迹） | 与主卡重复刷同一长文 |
| 完成后主幕 | 短汇总（目标/改动/验证，截断） | 把审查长文当完成页正文 |

---

## 3. 领域模型

### 3.1 CollaborationRun

```text
CollaborationRun
  runId
  workspaceId / workspaceRoot / sessionId
  requestText
  defaultTarget          // 入口 target；权威在 stages[].target
  status                 // 见状态机
  planRevision           // 规划修订号（确认时对齐）
  plan?                  // PlanDraft（确认用，非最终答案）
  stages[]               // 有序
  activeAttemptIds[]
  diagnostics[]
  finalSummary?          // 短汇总
  requestedAt / approvedAt? / updatedAt
```

### 3.2 Stage

```text
Stage
  id                     // plan | implement | review
  title / role
  target                 // ExecutionTarget（引擎+供应商+模型）
  accessMode             // read-only | current
  status                 // pending | running | succeeded | failed | skipped
  attemptId? / bindingKey?
  startedAt? / settledAt?
  shortOutcome?          // 主时间线一行，禁止长文
  error?
```

### 3.3 PlanDraft

规划段产物，仅服务「确认」与实现段上下文：

```text
PlanDraft
  schemaVersion = 1
  summary        // 一句话
  markdown       // 步骤/风险/验收
  steps[]?       // 可选列表
```

### 3.4 PreparedAttempt

调度输出，供前端 drive ordinary turn：

```text
PreparedAttempt
  runId, stageId, attemptId, logicalTurnId
  bindingKey, target, accessMode
```

---

## 4. 状态机

### 4.1 Run 状态

```text
                    ┌──────────────┐
                    │   Planning   │
                    └──────┬───────┘
                           │ plan stage succeeded
                           ▼
                  ┌────────────────────┐
                  │ AwaitingApproval   │
                  └─────────┬──────────┘
                            │ user approve
                            ▼
                  ┌────────────────────┐
                  │   Implementing     │
                  └─────────┬──────────┘
                            │ implement succeeded
                            ▼
                  ┌────────────────────┐
                  │    Reviewing       │
                  └─────────┬──────────┘
                            │ review settled
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
         Succeeded       Failed      Cancelled
```

说明：

- **AwaitingApproval 是产品门闩**（默认开启）：未确认不进实现。
- 审查启动失败但实现已成功时，可 **降级 settle succeeded**，`finalSummary` 用实现短说明（实现层已有此兜底）。
- `Failed` / `Cancelled` 为 terminal；diagnostics 必可展示。

### 4.2 Stage 状态

```text
Pending → Running → Succeeded
                  → Failed
Pending → Skipped   // run 取消或上游失败跳过
```

### 4.3 调度规则（V1）

1. **严格串行**：仅上一段 `succeeded` 后才启动下一段。
2. **单 session 单 active run**。
3. **每 stage 最多一个 active attempt**（重试可后续加预算）。
4. **exact owner**：interrupt / recover 只认 durable `attemptId` + bindingKey。
5. **不解析 prose 驱动状态**：只认 turn terminal + control plane 写入的 outcome fact。

---

## 5. Target 与权限

### 5.1 Execution Target

与 Shared Session 一致：

```text
engine
providerProfileId / providerProfileSource / providerProfileNameSnapshot
modelCatalogEntryId / model
reasoningEffort?
runtimeCapabilityFingerprint?
```

Turn 创建时冻结为 `TurnExecutionSnapshot`，不因 Picker 后续变更而漂移。

### 5.2 每 Stage 独立 Target

```text
stageBindings: [
  { id: "plan",      target: T_plan },
  { id: "implement", target: T_impl },
  { id: "review",    target: T_review },
]
```

- 未提供 bindings → 三段 = 入口 `target` 克隆。
- 提供部分 bindings → 按 id 覆盖对应 stage。
- 每段独立 `validate_resolved_execution_target` + 引擎准入。

### 5.3 权限类

| Stage | accessMode | 说明 |
|-------|------------|------|
| plan | 优先 `read-only` | 规划禁止写盘；无硬只读引擎可降级 `current` 但 prompt 仍禁写 |
| implement | `current` | 允许工作区变更 |
| review | 优先 `read-only` | 审查与短汇总，默认不写 |

### 5.4 写盘能力（产品策略）

- **推荐**：实现段使用 Codex（工作区沙箱与现有 Shared 写路径更成熟）。
- **允许**：其他 Shared 引擎跑实现段；失败 fail-visible，不静默吞。
- **禁止**：自动 commit / push / deploy / 出 workspace。

### 5.5 支持的引擎集合（V1）

与 Shared Session 可执行集对齐：`codex` / `claude` / `kimi` / `grok` / `opencode`。  
**不限制** Claude 下的供应商（MiniMax、官方、自建网关等）——限制的是 **engine 能力**，不是供应商名单。

---

## 6. 持久化与 Fact 映射

### 6.1 原则

- SharedEventWriter 仍是唯一写权威。
- V1 **复用**既有 `squad.*` fact wire（减少 schema 爆炸），**语义重写**为 multi-cli collab：
  - `stageId` 写入 `squadNodeId` / outcome `node_id`
  - `stageBindings` 写入 `SquadRunRequested.extra`
  - 新写入标记 `orchestration: multi-cli-collab-v1`
- 历史旧 Squad DAG 事件只读兼容，不再作为新写入模板。

### 6.2 Fact → 语义

| Fact | 协作语义 |
|------|----------|
| `squad.runRequested` | Run 创建 + stageBindings + workspaceRoot |
| TurnRequested（带 squad* extra） | Stage 开始 / attempt 绑定 |
| `squad.planProposed` | 规划草稿就绪 → AwaitingApproval |
| `squad.planApproved` | 用户确认 → 可启动 implement |
| `squad.nodeOutcomeRecorded` | Stage 结算（plan/implement/review） |
| `squad.branchBlocked` | 失败诊断 |
| `squad.cancelRequested` | 取消意图 |
| `squad.runSettled` | Run 终态 + finalSummary |

### 6.3 Projection

`AgentProjectionV1` 由 pure projector 从事件重建：

- 不写 runtime 侧车状态
- 重启后可恢复 stages 状态与 shortOutcome
- `finalSummary` 仅短文本（实现层截断，如 480 字）

---

## 7. Runtime 执行

### 7.1 Worker Turn

每 stage 通过既有 `begin_squad_worker_turn_core`（或后续重命名的 `begin_agent_stage_turn`）：

```text
bindingKey = squad:{runId}:{stageId}:{engine}:{provider}
```

- 与主对话 linear attempt 隔离
- 支持 exact interrupt / recover
- Context 最小：任务原文 + 上游 short/plan 必要上下文（实现段带 PlanDraft；审查段带实现短说明）

### 7.2 前端 Executor 驱动

```text
requestRun → drive(planAttempt) → recordPlan
approve → drive(implementAttempt) → recordExecute
       → drive(reviewAttempt) → recordReview → settled
```

- drive = prepareDelivery + dispatchTurn + awaitTerminal
- 超时 / 模糊 recovery → cancel 或 fail-visible，禁止 blind replay

### 7.3 实时直播通道

```text
AppServer realtime
  → 若 attempt 属于 collab stage
  → 不写主 Messages 根链
  → 写入 livePhaseChannel（按 workspace+thread）
  → Inspector /（可选）阶段预览订阅
```

**合并规则**（避免串字）：

- 新文本以旧文本为前缀 → 视为累计快照，**替换**
- 否则 → 真 delta，**append**
- 重复段 / 回退更短快照 → 忽略

### 7.4 与引擎原生子代理的关系

- Collab **不**把 Task/SubAgent 当 first-class stage。
- 规划 prompt **禁止**工具与子代理；模型违令时可能出现引擎层「用户已中断」——属引擎生命周期，不是协作 stop。
- UI：**协作 run 活跃时，协作 Inspector 优先于原生子代理分屏**，避免抢屏。

---

## 8. UI / UX 规格

### 8.1 入口

- Composer 旁 **协作** toggle（arm 下一次发送）
- 仅 Shared Session + 完整 target + 无附件/不支持的上下文引用
- 活跃 run 时禁止重复 arm

### 8.2 主幕布协作卡

```
┌─────────────────────────────────────────────┐
│ 多 Agent 协作                    [待确认]   │
│ {requestText}                               │
│ 编排说明（一句话）                          │
│ ┌─────────────────────────────────────────┐ │
│ │ 1 规划  Claude · MiniMax-M3   运行中…  │ │
│ │ 2 实现  Codex · gpt-5         等待中   │ │
│ │ 3 审查  Claude · MiniMax-M3   等待中   │ │
│ └─────────────────────────────────────────┘ │
│ [确认并实现]  [停止]                        │
└─────────────────────────────────────────────┘
```

- 点击 stage 行 → 打开右侧并选中该 stage
- 确认仅在 `awaiting-approval`
- 成功时在卡内展示 **协作汇总** 短块；主对话另投一条 assistant 短消息

### 8.3 右侧节点直播

```
┌ 节点直播 ─────────────────┐
│ 实现 · Codex · gpt-5      │
│ [规划] [实现*] [审查]      │
│                           │
│ （实时文本）              │
└───────────────────────────┘
```

- 仅当前选中 stage 的 live / shortOutcome / plan markdown（规划确认态）
- 不承载主编排控件（确认/停止留在主卡）

### 8.4 完成态（正确表达）

应表达：

```text
✓ 规划  Claude · MiniMax     摘要一行
✓ 实现  Codex · …            改动一行
✓ 审查  Claude · …           通过
────────
短汇总：…（≤约 12 行量级）
```

禁止：把 README 分析长文塞满完成卡。

---

## 9. API 契约（Tauri）

| Command | 作用 |
|---------|------|
| `shared_agent_request_run` | 创建 run + stageBindings + 启动 plan attempt |
| `shared_agent_record_plan` | 规划 turn terminal → PlanDraft + awaiting-approval |
| `shared_agent_approve` | 确认 revision + 启动 implement attempt |
| `shared_agent_record_execute` | 实现结算 + 启动 review attempt |
| `shared_agent_record_review` | 审查结算 + run settled + finalSummary |
| `shared_agent_get` | 最新 projection |
| `shared_agent_cancel` / `shared_agent_finalize_cancel` | 取消与收口 |

**Request 关键字段：**

```json
{
  "workspaceId": "...",
  "threadId": "shared:...",
  "text": "用户任务",
  "target": { "engine": "claude", "model": "...", "...": "..." },
  "stageBindings": [
    { "id": "plan", "target": { "engine": "claude", "...": "..." } },
    { "id": "implement", "target": { "engine": "codex", "...": "..." } },
    { "id": "review", "target": { "engine": "claude", "...": "..." } }
  ]
}
```

**Response 关键字段：**

```json
{
  "projection": { "runId": "...", "status": "...", "stages": [ /* ... */ ] },
  "stageAttempt": { "stageId": "plan", "attemptId": "...", "bindingKey": "...", "target": {}, "accessMode": "read-only" }
}
```

---

## 10. Prompt 契约（Stage 输入）

### 10.1 Plan

- 只产出计划文本；**禁止**工具 / Task / 子代理 / 写盘
- 输出 `SUMMARY:` + Markdown + 可选 `STEPS:`
- 信息不足 → 写假设，不查库

### 10.2 Implement

- 输入：用户任务 + PlanDraft
- 允许工作区变更；禁止 commit/push/deploy
- 结束说明控制在短 Markdown（实现层再截断 shortOutcome）

### 10.3 Review

- 输入：任务 + 计划摘要 + 实现短说明
- **只输出短汇总**（完成了什么 / 关键改动 / 如何验证 / 风险）
- 禁止长分析、禁止大段贴码、默认禁止写盘工具

---

## 11. 失败、取消与恢复

| 场景 | 行为 |
|------|------|
| Plan 空/不可解析 | fail-visible + diagnostics；run failed |
| 用户不确认 | 可停在 awaiting-approval；cancel 收口 |
| Implement 失败 | run failed；review 不启动 |
| Review 起不来但 implement 成功 | 可降级 succeeded + 实现短说明作汇总 |
| 用户 Stop | cancel intent → interrupt exact attempts → settled cancelled |
| 进程崩溃 | 从 facts 重建 projection；running attempt recover 或 fail closed |
| Target 变更 | stage 已冻结 target，不跟 Picker |

---

## 12. 性能与渲染

1. Stage 正文 **禁止**每 delta 进 AppShell 根 reducer。
2. Live 通道独立订阅；cadence 合并（如 ~48ms）降低 inspector 抖动。
3. 主卡只吃 projection 状态事件（低频）。
4. 长列表 / 多 run 历史：只保留最新 active run 于 session；历史 projection 可按需 hydrate。

参照：`docs/perf/render-jank-knife-experiments-2026-07-08.md`、`docs/perf/a4-live-text-externalization-plan.md`。

---

## 13. 安全与权限边界

- Workspace root 在 run 请求时封存；运行中 root 变化 → fail closed。
- 实现段不得越权出 workspace、不得碰 credentials 路径（依赖 CLI 沙箱 + prompt 约束）。
- 不自动 git commit / push / reset / stash。
- Kill switch：`CCGUI_AGENT_ORCHESTRATION_V1` / 前端 flag，关闭后禁新 run，历史可读。

---

## 14. 代码落点（当前仓库）

| 层 | 路径 |
|----|------|
| 后端 control plane | `src-tauri/src/agent_orchestration/**` |
| Tauri commands | `shared_agent_*`（`command_registry.rs`） |
| 前端 feature | `src/features/multi-agent/**` |
| 服务 | `src/services/tauri/agentOrchestration.ts` |
| 样式 | `src/styles/multi-agent.css` |
| i18n | `src/i18n/locales/{zh,en}/multiAgent.ts` |
| 发送入口 | `useThreadMessaging`（`squadRequest` + stageBindings） |
| Realtime 旁路 | `useAppServerEvents` → livePhaseChannel |

> 文档描述 **目标产品架构**；若实现与文档冲突，以本设计 + 后续 OpenSpec change 校准为准，再回写代码。

---

## 15. 验收标准

### 15.1 功能

1. 协作发送后主卡展示 **三段编排**，每段可见 **CLI · 模型徽章**。
2. 规划结束后状态为 **待确认**；未确认不进实现。
3. 确认后按序 **实现 → 审查**；点某段右侧只播该段。
4. 成功后主卡/主对话仅 **短汇总**，无半屏 dump。
5. 停止可收口 terminal；diagnostics 失败可见。
6. 传入不同 `stageBindings` 时，各段使用各自 target（契约层）。

### 15.2 体验

1. 协作活跃时不被原生子代理面板抢屏。
2. 直播无「双重串字」。
3. 规划中主幕不空白到「无生命周期」——至少有三段卡与状态。

### 15.3 工程

1. `cargo check` / `tsc --noEmit` 通过。
2. 不把高频 delta 写进根 reducer。
3. Session 单 active collab run。

---

## 16. 演进路线

| 阶段 | 内容 |
|------|------|
| **V1（当前设计）** | 固定 plan → confirm → implement → review；串行；每段 target 契约；主编排 + 节点直播 + 短汇总 |
| **V1.1** | Composer 内逐段选 CLI/供应商 UI；默认「实现推荐 Codex」提示 |
| **V1.2** | Stage 级重试预算；审查可选跳过 |
| **V2** | 有限并行只读 fan-out；用户自定义 N 段；模板市场 |
| **V3** | 受控 DAG / 条件边；仍禁止无协调多写 |

---

## 17. 术语表

| 术语 | 含义 |
|------|------|
| Collaboration / 协作 | 本功能产品名；多引擎分环节编排 |
| Stage / 环节 | 管线上有序步骤，带独立 target |
| Execution Target | 引擎+供应商+模型等可冻结执行目标 |
| Control Plane | mossx 持有的调度与权威状态 |
| Worker Turn | 某 stage 在 CLI runtime 上的 ordinary turn |
| shortOutcome | 主时间线一行结果 |
| finalSummary | 给用户的短汇总 |
| Scoped Binding | 按 run+stage+target 隔离的 continuation owner |
| 原生子代理 | 引擎内部 Task/SubAgent，非 collab stage |

---

## 18. 相关文档

- Shared / multi-CLI 基石：`docs/research/mossx-multi-cli-provider-session-foundation-design.md`
- 新 CLI 接入：`docs/research/mossx-new-cli-onboarding-guide.md`
- 渲染性能：`docs/perf/render-jank-knife-experiments-2026-07-08.md`
- 规则入口：`AGENTS.md`、`openspec/`

---

## 19. 修订记录

| 日期 | 说明 |
|------|------|
| 2026-08-05 | 首版：对齐「多引擎分环节编排」产品真相，纠正单 target 流水线与完成页 dump 误区 |

---

**结语**

多引擎编排的价值不在「再多跑几次模型」，而在 **把正确的引擎组合用在正确的环节**，并让用户 **始终看懂编排**。  
主幕布负责 **组合与状态**；分屏负责 **节点现场**；结束只留 **短汇总**。这是本设计的唯一北极星。
