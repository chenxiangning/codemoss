## Overview

本设计对应提案 `chat-canvas-conversation-curtain-architecture-refactor`
，目标是在不破坏现有功能的前提下，完成对话幕布从“渲染共用 + 数据链路分裂”到“渲染内核共用 + 接入适配独立 + 语义契约统一”的结构升级。

本次设计优先解决“可维护性、一致性、可验证性”三件事，不以视觉大改为主目标。

## Design Goals

1. 实时与历史详情统一到同一语义契约，消除同一条会话在两条链路的展示歧义。
2. 将引擎协议差异收敛到 Adapter/Loader 层，避免渲染层被协议细节污染。
3. 在保持现有交互能力的前提下分阶段迁移，并提供可回滚路径。
4. 将 Plan/Tool/Reasoning/UserInput 作为关键一致性能力，纳入门禁验证。

## Current-State Baseline

### 当前职责分布

| 层      | 当前状态                       | 主要痛点                |
|--------|----------------------------|---------------------|
| 引擎事件接入 | 分散在 thread hooks 与 reducer | 语义转换散落，跨文件排查困难      |
| 历史会话恢复 | Codex/Claude/OpenCode 差异明显 | 实时与历史不对齐，回放稳定性不足    |
| 幕布渲染   | `Messages` 分发机制相对统一        | 上游异构数据导致下游补丁式修复     |
| 样式与组件  | 工具卡、Markdown、Plan 面板已模块化   | 缺少架构级一致性约束，回归依赖人工经验 |

### 当前关键不一致矩阵

| 场景            | 实时路径                     | 历史路径            | 风险         |
|---------------|--------------------------|-----------------|------------|
| tool 输出与状态    | 增量 delta + turn finalize | 按引擎映射回放，字段完整性不一 | 状态和输出体量不一致 |
| reasoning 展示  | summary/content 流式合并     | 可能只恢复片段或标题      | 标题与正文语义偏差  |
| plan 快览/面板    | turn plan update 驱动      | 依赖 thread 计划恢复  | 快览和面板可能分裂  |
| opencode 等待提示 | heartbeat 动态提示           | 历史无同等语义         | 体验连续性不足    |

## Target Architecture

### 分层结构（To-Be）

| 层级                             | 责任        | 输入                                                    | 输出                          |
|--------------------------------|-----------|-------------------------------------------------------|-----------------------------|
| L1 Engine Adapter Layer        | 引擎协议事件标准化 | 原始 app-server / engine event                          | `NormalizedThreadEvent`     |
| L2 History Loader Layer        | 历史会话标准化   | 引擎历史 session/thread 数据                                | `NormalizedHistorySnapshot` |
| L3 Conversation Assembly Layer | 状态组装与合并   | `NormalizedThreadEvent` + `NormalizedHistorySnapshot` | `ConversationState`         |
| L4 Curtain Rendering Kernel    | 统一分发与排版渲染 | `ConversationState`                                   | 稳定 UI                       |
| L5 Presentation Profile Layer  | 引擎展示差异注入  | engine id + render context                            | 局部样式/文案差异                   |

### 接口契约

```ts
export interface RealtimeAdapter {
  engine: "codex" | "claude" | "opencode";
  mapEvent(input: unknown): NormalizedThreadEvent | null;
}

export interface HistoryLoader {
  engine: "codex" | "claude" | "opencode";
  load(threadId: string): Promise<NormalizedHistorySnapshot>;
}

export interface ConversationAssembler {
  appendEvent(state: ConversationState, event: NormalizedThreadEvent): ConversationState;
  hydrateHistory(snapshot: NormalizedHistorySnapshot): ConversationState;
}

export interface PresentationProfile {
  engine: "codex" | "claude" | "opencode";
  resolveWorkingHint(input: ConversationState): string | null;
  resolveMessageClassName(role: "user" | "assistant"): string;
}
```

### 统一语义对象（核心）

| 对象                   | 关键字段                                | 约束                         |
|----------------------|-------------------------------------|----------------------------|
| `ConversationItem`   | `kind` + payload                    | 实时和历史必须同构                  |
| `TurnPlan`           | `turnId/explanation/steps`          | quick view 与 panel 共用同一数据源 |
| `UserInputQueue`     | `request_id/thread_id/workspace_id` | 线程隔离、FIFO、去重               |
| `ThreadTimelineMeta` | `activeTurnId/isThinking/heartbeat` | 仅作为状态，不参与内容语义歧义            |

## Convergence Strategy

### 实时与历史收敛流程

1. 引擎原始事件进入 `RealtimeAdapter`，输出 `NormalizedThreadEvent`。
2. 引擎历史数据进入 `HistoryLoader`，输出 `NormalizedHistorySnapshot`。
3. `ConversationAssembler` 统一执行 merge/upsert/normalize。
4. 渲染层仅消费 `ConversationState`，不读引擎原始字段。
5. 差异性展示通过 `PresentationProfile` 注入，不改变语义对象。

### 实时与历史一致性规则

| 类型        | 一致性规则                                 | 违规判定                             |
|-----------|---------------------------------------|----------------------------------|
| message   | 同 role/text/images 必须产生同等 Markdown 展示 | 实时可见历史缺失、历史新增实时无来源               |
| reasoning | 标题/正文拆分规则一致                           | title-only 与 full-body 混用导致语义不一致 |
| tool      | `status/output/changes` 规则一致          | 回放状态与实时最终态冲突                     |
| plan      | 快览与右侧面板步骤顺序一致                         | 快览缺项或状态漂移                        |
| userInput | 队列顺序与线程隔离一致                           | 跨线程泄漏、重复请求                       |

## Engine-Specific Boundary

| 引擎       | Adapter 独立职责                  | Loader 独立职责          | 允许的展示差异                                |
|----------|-------------------------------|----------------------|----------------------------------------|
| Codex    | item/tool/reasoning/turn 事件映射 | `resume_thread` 结构映射 | codex-canvas lead marker、activity hint |
| Claude   | session JSONL 事件归一化           | JSONL 历史回放映射         | 文案和图标轻量差异                              |
| OpenCode | heartbeat/non-streaming 事件归一化 | 会话恢复字段补齐             | waiting hint 与 heartbeat 相关提示          |

约束：引擎差异不得绕过 `ConversationAssembler` 直接改渲染分发语义。

## Module Split Proposal

建议落地目录（示意）：

```text
src/features/threads/adapters/
  codexRealtimeAdapter.ts
  claudeRealtimeAdapter.ts
  opencodeRealtimeAdapter.ts
  codexHistoryLoader.ts
  claudeHistoryLoader.ts
  opencodeHistoryLoader.ts
src/features/threads/assembly/
  conversationAssembler.ts
  conversationNormalize.ts
src/features/messages/profiles/
  codexProfile.ts
  claudeProfile.ts
  opencodeProfile.ts
```

现有 `Messages`、`ToolBlockRenderer`、`Markdown` 继续保留为渲染内核，不再承载协议解释逻辑。

## Migration Plan

### 分阶段迁移矩阵

| 阶段              | 入口条件       | 主要动作                               | 退出条件                        | 回滚点                  |
|-----------------|------------|------------------------------------|-----------------------------|----------------------|
| Phase 1: 契约与骨架  | 提案和设计确认    | 引入 Adapter/Loader/Assembler 接口与空实现 | 类型通过，旧路径不变                  | 删除新骨架即可              |
| Phase 2: 实时接入迁移 | Phase 1 完成 | 三引擎 realtime adapter 接管事件归一化       | 实时功能回归通过                    | 切换回旧事件处理分支           |
| Phase 3: 历史恢复迁移 | Phase 2 完成 | 三引擎 history loader 统一装配            | 实时/历史对比基线通过                 | 回退到旧 history restore |
| Phase 4: 渲染内核收口 | Phase 3 完成 | 清理渲染层协议分支，接入 profile               | 渲染分发仅依赖 `ConversationState` | feature flag 切回旧渲染输入 |
| Phase 5: 收敛与清理  | Phase 4 完成 | 删除冗余兼容分支，固化测试门禁                    | 无双路径残留                      | 保留最近稳定 tag 回滚        |

### Feature Flag 计划

| Flag                                | 默认值   | 作用                      | 停用条件       |
|-------------------------------------|-------|-------------------------|------------|
| `chatCanvasUseNormalizedRealtime`   | false | 控制 realtime adapter 新路径 | Phase 5 完成 |
| `chatCanvasUseUnifiedHistoryLoader` | false | 控制 history loader 新路径   | Phase 5 完成 |
| `chatCanvasUsePresentationProfile`  | false | 控制 profile 注入路径         | Phase 5 完成 |

## Verification Plan

### 测试分层矩阵

| 层级                 | 测试类型      | 覆盖重点                             |
|--------------------|-----------|----------------------------------|
| Adapter/Loader     | 单元测试      | 原始事件/历史样本到规范化对象映射                |
| Assembler          | 单元 + 属性测试 | merge/upsert、delta 拼接、去重、顺序一致    |
| Messages Kernel    | 组件测试      | 分发路径、折叠展开、状态色、排版                 |
| Thread Integration | 集成测试      | 实时+历史一致性、跨引擎回放一致性                |
| E2E Smoke          | 冒烟测试      | 发消息、工具执行、plan 快览、user input、历史恢复 |

### 一致性门禁（必须）

1. 同一条会话在实时与历史路径的 `ConversationItem` 序列可比对（字段一致或有明确可忽略白名单）。
2. Plan quick view 与 Plan panel 在同线程同 turn 下结果一致。
3. OpenCode heartbeat 仅影响等待提示，不影响消息语义结构。
4. 旧路径关闭前，关键场景双路径 diff 为零或在白名单内。

## Observability and Performance

### 可观测性事件

| 事件                           | 字段                        | 用途           |
|------------------------------|---------------------------|--------------|
| `chat_canvas_adapter_mapped` | engine/eventType/success  | 监控适配成功率      |
| `chat_canvas_history_loaded` | engine/threadId/itemCount | 监控历史恢复质量     |
| `chat_canvas_assembly_diff`  | threadId/diffKind/count   | 监控实时/历史差异    |
| `chat_canvas_render_profile` | engine/profileName        | 监控引擎差异路径是否可控 |

### 性能目标（阶段目标）

| 指标          | 目标      |
|-------------|---------|
| 流式更新时主线程卡顿  | 不高于现状基线 |
| 首次历史恢复可交互时间 | 不高于现状基线 |
| 渲染层重排次数     | 不高于现状基线 |

注：以“先不退化、后优化”为原则，优先保障重构安全。

## Risks and Mitigations

| 风险      | 描述           | 缓解策略                        |
|---------|--------------|-----------------------------|
| 抽象过度    | 一次性抽太深导致推进缓慢 | 先收敛高频类型，再扩展边缘类型             |
| 双路径并行过久 | 长期维护两套逻辑     | 每阶段设置明确下线时间                 |
| 历史数据脏样本 | 老会话字段缺失或畸形   | normalize fallback + 样本修复清单 |
| 视觉回归    | 样式被架构改造误伤    | 渲染层只做输入替换，不改样式 token        |

## Open Questions

1. OpenCode 历史详情字段缺失由后端补齐还是前端 fallback，最终 ownership 归属需确认。
2. `explore` 聚合继续放在 `prepareThreadItems` 还是迁移到 assembler 阶段，需评估回归影响。
3. Plan 是否需要快照版本号以支持历史回放精确对齐，需结合存储成本评估。
