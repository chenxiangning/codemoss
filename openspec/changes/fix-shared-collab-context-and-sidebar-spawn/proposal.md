## Why

Shared 多 CLI 协作阶段 1 已能跑通串行编排，但留下两个 Shared-only P0：

1. **AI 上下文空洞**：协作子节点产出人可在右栏查看，但主幕 subsequent ordinary turn 的 Context Compiler 不把 stage 产出编入 prompt，续聊时模型像新会话（仅 residual memory/git）。
2. **侧栏下崽**：Shared Hidden Native Binding / context package 会话（如 `MOSSX_CONTEXT…`、空 `Claude Session`）泄漏进左侧 thread list，过滤不全。

普通 Shared（无协作）与 native CLI 行为不在本变更范围。

## 目标与边界

### 目标

| ID | 目标 | 可测定义 |
|----|------|----------|
| G1 | 协作后 ordinary turn 能看到子节点产出 | 存在 stage succeed 后，下一轮 `prepare_delivery` 的 package/promptPrefix 含各 stage body/summary（有预算上限） |
| G2 | 取消/部分完成也保留 partial digest | run cancelled 且 ≥1 stage succeeded → 后续 ordinary turn 仍含已完成 stage 产出 |
| G3 | 无协作时零回归 | 无 `squad.nodeOutcomeRecorded` 的 session 编译路径与 baseline 一致 |
| G4 | 侧栏不展示 Shared 内部 binding 行 | 协作/context 注入后侧栏无 `MOSSX_CONTEXT*` 标题行、无 hide set 命中 native id |
| G5 | 不改人眼主幕 | 不重做普通气泡时间线；不要求主幕展开 stage 全文 |

### 边界

- Shared Session V2：event log / context compiler / prepare_delivery / sidebar hide strip。
- multi-agent（`agent_orchestration`）node outcome 落盘字段。
- Frontend：thread list hide / control-plane 标题闸。

## 非目标

| 项 | 原因 |
|----|------|
| 重做主幕 UI / HistoryFold 给人看全文 | 人侧栏 Inspector 已足够 |
| native CLI 会话列表架构 | 范围外 |
| 自动删盘 orphan native session | 卫生可选；本波次 hide + 标题闸 |
| 每轮无条件全量 rematerialize | 破坏 no-replay / A-B-A |
| Squad 并行 DAG / 多写 | 非本 change |

## What Changes

- **Node outcome 持久化 body**：`squad.nodeOutcomeRecorded.outcome` 除 short `summary` 外写入 capped `body`（阶段全文安全阀）。
- **Context Compiler**：将 `squad.nodeOutcomeRecorded` 投影为 portable 上下文条目（标注 collab stage）；**禁止** destination-owned 省略；协作 control briefing user turn 可降权/省略以省 budget。
- **Sidebar**：final hide strip 之外，对 context-protocol 首条/标题（`MOSSX_CONTEXT_*`）的 native 行做防御性剔除。
- **基石文档**：校准「协作 digest 进 Runtime Context」与「Sidebar 永不展示 hidden binding」。

## Capabilities

### New Capabilities

- `shared-collab-stage-context`：协作 stage 产出如何进入 ordinary turn 的 Context Package（含 cancel partial）。

### Modified Capabilities

- `shared-context-compiler`：必须消费 collab stage outcome；destination-owned 不得吞掉 collab digest。
- `shared-session-thread`：侧栏 hide 与 control-plane 标题泄漏防护。

## Impact

| 层 | 触点 |
|----|------|
| Backend | `agent_orchestration/commands.rs`（outcome body）、`shared_context/compiler.rs`、可选 tests |
| Frontend | `useThreadActions.helpers.ts` strip 扩展、Vitest |
| Docs | `docs/research/mossx-multi-cli-provider-session-foundation-design.md` |
| 无 schema migration | outcome 为 JSON Value 增字段；旧行无 body 时 fallback summary |

## 技术方案对比与取舍

| 方案 | 说明 | 取舍 |
|------|------|------|
| A. 仅依赖 turnCommitted 原文 | 工具多时 text 空；briefing 占 budget | 拒绝作唯一路径 |
| B. 每 ordinary turn 前端拼 stage 进 prompt | 绕过 Canonical/compiler | 拒绝：破坏 identity |
| **C. nodeOutcome body + compiler 一等投影（采用）** | durable、跨 binding、cancel partial 可证 | **采用** |
| D. 主幕展开全文给人看 | 非用户诉求 | 不做 |

## 验收标准

1. 协作至少一 stage 成功后，在主幕普通发送：destination 模型入站含该 stage 产出要点/正文（cap 内）。
2. 协作取消（2/3 完成）后续聊：含已完成 stage，不含未跑 stage 臆造。
3. 无协作 Shared 单测/路径无行为 diff。
4. Shared 协作/context 注入后侧栏无 `MOSSX_CONTEXT*` 行；hide set 命中 id 不出现。
5. `openspec validate fix-shared-collab-context-and-sidebar-spawn --strict` 通过；focused Rust + Vitest 通过。
6. **不提交**；作者 review 后由用户检查。

## 验收回写（2026-08-06 用户实机）

| 项 | 结果 |
|----|------|
| G1 协作后 ordinary turn 见子节点 | **通过**。用户主幕问「第一轮协作有几个写作节点、每个干了什么」→ 模型准确列出 plan/implement/review 三点结论（表格 + 路径/验证/APPROVE） |
| G3 无协作零回归 | 本轮未报回归 |
| 人眼主幕 | **未改**（符合边界） |

> 结论：本 change 的 **Runtime Context（AI 吃 stage body）方向正确、已实机验证**。  
> **不在本 change 范围**：协作右栏 **流式渲染 P0**（旁路 `extractRealtimeTextDelta`）→ 另开实施 `fix-shared-collab-inspector-streaming`（按主幕布 adapter + liveAssistantTextChannel 复刻）。
