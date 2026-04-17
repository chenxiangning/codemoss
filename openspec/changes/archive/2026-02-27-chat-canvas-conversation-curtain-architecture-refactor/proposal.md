## Why

当前对话幕布在“视觉渲染层”和“数据装配层”之间处于混合形态：渲染入口基本共用，但实时流与历史详情在不同引擎（Codex/Claude/OpenCode）上走了不同链路，导致一致性和可维护性持续下降。随着后续要重点优化对话幕布，必须先用一次结构化提案明确分层边界、差异基线和演进路线，避免继续在现有耦合点上叠加复杂度。

## 背景与现状

### 现状分层诊断（As-Is）

| 维度         | 当前实现                                              | 主要问题                          |
|------------|---------------------------------------------------|-------------------------------|
| 对话幕布与主渲染   | `Messages` 统一分发 `ConversationItem`，UI 风格大体共用      | 渲染层可复用，但被上游异构数据喂入方式牵制         |
| 实时事件处理     | item/turn 事件进入 reducer，流式 delta 合并策略完整            | 各引擎协议细节散落在 hook/reducer，边界不清晰 |
| 历史详情装配     | Codex/Claude/OpenCode 各自链路差异显著                    | “实时看起来一致，历史回放不一致”成为长期风险       |
| 工具/计划/提问卡片 | 有统一组件族（tool blocks、plan panel、request user input） | 组件共用但语义来源不统一，跨引擎回归成本高         |

### 实时对话结构与渲染入口基线（已验证）

| 项目                       | 数量 | 说明                                                                       |
|--------------------------|---:|--------------------------------------------------------------------------|
| `ConversationItem.kind`  |  6 | `message/reasoning/diff/review/explore/tool`                             |
| 分组后的 `GroupedEntry.kind` |  5 | `item/readGroup/editGroup/bashGroup/searchGroup`                         |
| 工具单项渲染分发类型               |  6 | `Bash/Read/Edit/Search/MCP/Generic`                                      |
| 关键渲染分发入口                 |  4 | `renderEntry`、`renderSingleItem`、`ToolBlockRenderer`、`Markdown.PreBlock` |

### 引擎差异与一致性现状

| 维度          | Codex                            | Claude            | OpenCode                      | 结论                     |
|-------------|----------------------------------|-------------------|-------------------------------|------------------------|
| 实时渲染主路径     | 共用幕布与 item 分发                    | 共用幕布与 item 分发     | 共用幕布与 item 分发（含 heartbeat 提示） | 实时层基本共用                |
| 历史详情装配      | `resume_thread` + thread item 转换 | session(JSONL) 映射 | session 级处理能力存在但详情装配链路不对齐     | 历史层明显分裂                |
| 实时 vs 历史一致性 | 高                                | 中                 | 低                             | 当前“共用”停留在 UI 层，不是端到端一致 |

## What Changes

- 建立“对话幕布重构”的分层架构基线：
    - 渲染内核共用（Curtain Rendering Kernel）
    - 引擎接入独立（Realtime Adapter + History Loader）
    - 统一的规范化会话模型（Canonical Conversation Model）
- 将实时与历史统一到同一渲染语义契约：
    - 同一类数据在实时和回放必须使用同一结构与同一渲染规则
    - 明确“引擎特性差异”与“UI 展示差异”的边界
- 将 Plan/Tool/Reasoning/UserInput 四类高频内容纳入统一一致性约束：
    - 保证同线程在实时态与历史态的状态标签、排序与可达性一致
- 引入重构期兼容策略：
    - 保留现有交互能力与现有行为兜底
    - 分阶段迁移，避免一次性切换引发回归

## 目标与边界

- 目标：把“渲染共用 + 数据分裂”的混合状态，升级为“渲染内核共用 + 接入适配独立 + 语义契约统一”的稳定架构。
- 目标：提升 Codex/Claude/OpenCode 在实时与历史两条路径上的一致性与可维护性。
- 目标：为后续幕布视觉和交互优化提供低风险演进底座。
- 边界：本提案定义架构与行为契约，不直接引入视觉风格大改。
- 边界：不改变业务侧模型能力，仅约束会话呈现与数据装配路径。

## 非目标

- 不在本提案中重构所有引擎 provider 的底层通信协议。
- 不在本提案中处理 provider 状态判定与发送通道稳定性治理（例如连接健康探测策略）。
- 不在本提案中引入新的协作模式产品能力。
- 不一次性替换全部历史会话存储格式。

## 技术方案对比

| 方案          | 描述                                  | 优点              | 缺点                 |
|-------------|-------------------------------------|-----------------|--------------------|
| A. 三套完全独立幕布 | 按 Codex/Claude/OpenCode 分别维护对话幕布与渲染 | 引擎特性开发自由度高      | 维护成本高、体验漂移、回归面指数扩大 |
| B. 一套完全共用到底 | 接入与渲染全部统一                           | 表面一致性最好、实现简单    | 被最弱引擎限制，差异难落地，扩展性差 |
| C. 分层解耦（推荐） | 接入层独立，渲染层共用，语义契约统一                  | 兼顾一致性、扩展性与演进安全性 | 需要前期抽象与迁移治理投入      |

取舍：采用 **C（分层解耦）**，把变化率高的引擎协议隔离在 adapter 层，把变化率低的幕布渲染与交互沉淀为稳定内核。

## Capabilities

### New Capabilities

- `chat-canvas-conversation-curtain-architecture`: 定义对话幕布分层架构、实时/历史统一语义契约、引擎接入适配边界与迁移门禁。

### Modified Capabilities

- `codex-chat-canvas-execution-cards-visual-refactor`: 工具卡片在重构后需满足统一数据契约与实时/历史一致渲染。
- `codex-chat-canvas-plan-visibility`: Plan 快览与右侧面板在新分层下保持语义一致与状态一致。
- `codex-chat-canvas-user-input-elicitation`: 用户提问卡片在统一事件与渲染契约下保持线程隔离与顺序一致。
- `opencode-engine`: OpenCode 在幕布统一策略下保留 heartbeat/非流式等待语义并提升历史回放一致性。

## 验收标准

1. 系统 SHALL 将实时与历史输入统一为同一 `ConversationItem` 语义契约，禁止同一类型出现双重解释。
2. 系统 SHALL 在三引擎下提供一致的幕布分发路径（message/reasoning/tool/diff/review/explore），且差异点可配置而非分叉复制。
3. 系统 SHALL 明确接入层独立边界：每个引擎至少具备独立 `RealtimeAdapter` 与 `HistoryLoader` 责任域。
4. 系统 SHALL 保证 Plan/Tool/Reasoning/UserInput 在实时与历史详情中的顺序与状态语义一致。
5. 系统 SHALL 提供分阶段迁移与回滚策略，确保重构期间现有功能无破坏性回归。
6. 系统 SHALL 通过最小回归集验证关键链路：消息流、工具卡片、计划快览、心跳等待态、历史恢复。

## Impact

- Frontend 渲染域：`src/features/messages/components/*`, `src/styles/messages.css`, `src/styles/tool-blocks.css`
- 线程事件与状态域：`src/features/threads/hooks/useThreadItemEvents.ts`, `useThreadTurnEvents.ts`, `useThreadsReducer.ts`
- 会话模型装配域：`src/utils/threadItems.ts`
- 相关能力规格：
    - `specs/codex-chat-canvas-execution-cards-visual-refactor/`
    - `specs/codex-chat-canvas-plan-visibility/`
    - `specs/codex-chat-canvas-user-input-elicitation/`
    - `specs/opencode-engine/`
    - 新增 `specs/chat-canvas-conversation-curtain-architecture/`
