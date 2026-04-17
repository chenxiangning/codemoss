## Why

当前右侧区域已经承载了 Git、File Tree、Search、Memory 等工作区级辅助信息，但“当前 session 正在做什么”仍然分散在对话幕布、底部 status panel、runtime console 和工具卡片里。  
结果是用户能看到局部事实，却看不到一条稳定、连续、可回看的“操作时间线”：刚刚跑了什么命令、任务推进到哪一步、改了哪些文件、当前是否还在执行。

你希望右侧区域做成类似图 2 `SOLO` 模式的实时监控视图，本质上是在现有 chat canvas 旁边补一个 `session activity surface`，把当前 session 的操作信息收束为单一信息源，降低上下文跳转成本。

## 目标与边界

- 目标：在右侧区域新增 workspace 级实时监控面板，聚合当前 workspace 下与当前任务相关的多 session 活动。
- 目标：面板按时间顺序展示主 session 与其派生子 session 的关键操作，至少覆盖终端命令、任务/计划推进、文件修改。
- 目标：第一阶段以 `command`、`task`、`fileChange` 三类可执行操作事实为主，并允许 `explore` 作为独立分类展示，避免其伪装进命令或任务统计。
- 目标：监控视图必须随相关 session 实时刷新，而不是等回合结束后一次性汇总。
- 目标：允许用户从监控项快速回到相关上下文，例如打开 diff、定位文件、查看命令详情，以及识别该操作来自哪个 session。
- 目标：右侧 activity panel 默认以统一时间线为主视图，保证用户先看到“刚刚发生了什么”，而不是先做 session 维度切换。
- 目标：若产品以 `SOLO` 视图模式承载该能力，则 MUST 明确进入方式、运行中退出能力与上下文恢复规则，避免用户被锁死在单一视图。
- 目标：优先复用现有 `ConversationItem[]`、tool card、status panel 提取逻辑，并在此基础上补充跨 session 聚合层，避免新增一套平行事件模型。
- 边界：本提案覆盖“当前 workspace 下主 session 及其派生子 session”的聚合监控，不扩展到无关联线程或其他 workspace。
- 边界：`相关 session` 明确定义为“当前 active thread 所在 root thread 及其 descendants，且这些 threads 必须属于当前 workspace”；不得把同 workspace 但无亲缘关系的其他任务线程混入。
- 边界：本提案只定义右侧实时监控信息架构与 UX 契约，不要求本次重做对话幕布本身。

## 非目标

- 不替换现有消息区工具卡片、status panel 或 runtime console，只做右侧新增视图与信息整合。
- 不追求采集 IDE 外部变更、git 原生命令、或非当前 session 触发的文件系统噪音。
- 不为所有引擎一次性做完全一致的展示，优先保证 `codex` session 路径完整，再评估 `claude` / `opencode` 对齐。
- 不做整个应用所有历史线程的全局活动中心，只聚焦当前 workspace 内当前任务上下文相关的 session 集。

## What Changes

- 新增右侧 panel tab，用于承载 `workspace session activity` 监控视图。
- 新增 session activity capability，定义“当前 workspace 下相关 session 的命令、任务、文件修改”在右侧的实时展示契约。
- 约束监控数据源优先来自各相关线程的 `ConversationItem[]`、thread status 与实时 adapter 事件，避免引入第二套难以对齐的前端状态。
- 为监控项定义统一摘要规则，减少幕布工具卡片、底部 status panel、右侧 activity panel 三处信息语义漂移。
- 对现有状态提取逻辑做增量复用或上提，沉淀可供右侧监控面板消费的 multi-session activity selector。
- 新增空态、运行态、结束态契约，保证“没有事件”“正在执行”“执行完成”三种场景都具备稳定反馈。
- 新增 session 归属与父子关系呈现契约，避免用户无法判断某条操作来自主 session 还是 AI 拉起的子 session。
- 为命令事件定义轻量展开契约：右侧只展开最近少量输出用于感知进展，完整输出仍通过既有 tool card / runtime console 查看。
- 若采用 `SOLO` 模式承载该监控能力，则新增 mode entry/exit contract：按钮进入、运行中可退出、退出不影响执行、再次进入可恢复上下文。
- 明确采用“新功能新代码 + adapter 接入”策略：旧的 status panel、messages、thread reducer 保持原职责，不做侵入式重写。
- 在 change 下补齐 delta specs，分别覆盖：新 capability、本次与 tool card 一致性相关的修改、以及 Codex 执行态摘要复用契约。

## 技术方案对比

### 方案 A：基于 workspace 内相关线程 `ConversationItem[]` 聚合派生右侧 activity panel

- 优点：和消息区、tool card、status panel 共用同一事实源，天然避免展示口径分裂。
- 优点：无需新增后端协议，改动集中在前端 selector、panel tab 和渲染组件。
- 优点：主 session 与 AI 派生子 session 可以通过现有 thread / session 关系在前端进行聚合展示。
- 缺点：如果某些跨 session 关联信息当前不完整，需要补齐 thread 关系元数据或归一化逻辑。
- 结论：采纳。

### 方案 B：为右侧面板单独建立 session telemetry store / event bus

- 优点：实时性控制最强，可做更细粒度的流式 UI。
- 缺点：会形成与幕布工具卡片平行的第二套状态模型，后续很容易出现“右侧和正文说的不是一回事”。
- 缺点：回放、持久化、线程切换恢复都需要额外治理。
- 结论：不采纳。

取舍：这个问题的关键不是“再做一个漂亮面板”，而是“把当前 workspace 任务相关的多 session 操作事实收口到同一来源”；因此先选事实统一，再谈视觉形态。

## Engineering Guardrails

- 本变更 MUST 优先通过新增组件、selector 和 adapter 完成，不得为了接入右侧面板而大面积改写既有消息区、status panel 或 thread reducer 逻辑。
- 既有 `ConversationItem[]`、`threadStatusById`、`threadParentById` 视为底层事实源；新面板只读消费这些状态，除非发现明确缺口，否则 MUST NOT 反向重构旧链路。
- 若现有提取逻辑不足，优先新增 `workspace session activity adapter`，而不是在老 UI 组件里硬塞新分支。
- 旧组件行为变更仅允许发生在必要的 adapter 接口暴露层，且 MUST 保持向后兼容。
- 新 capability 的实现 MUST 以独立模块形式落地；旧模块最多只允许抽出纯函数或暴露只读 selector，不得承担新的 workspace 聚合职责。

## Capabilities

### New Capabilities

- `codex-chat-canvas-workspace-session-activity-panel`: 定义当前 workspace 下多 session 在右侧区域的实时活动监控面板，包括信息范围、聚合规则、时间线结构、状态反馈与交互行为。

### Modified Capabilities

- `conversation-tool-card-persistence`: 补充右侧 activity panel 与消息区工具卡片的事实一致性要求，防止同一操作在不同视图中摘要冲突。
- `codex-chat-canvas-execution-cards-visual-refactor`: 补充实时 activity label 与右侧监控项共享摘要来源的要求，避免一处显示 Planning、另一处显示 Command 且互不对应。

## 验收标准

1. 当用户进入某个 workspace 的任务上下文时，系统 MUST 在右侧提供可切换的 workspace session activity 面板入口。
2. 右侧 session activity 面板 MUST 按时间顺序聚合展示当前 workspace 下与当前任务相关的主 session 及其派生子 session 关键操作，并至少覆盖命令执行、任务推进、文件修改三类事件。
3. 当主 session 或任一相关子 session 持续产生新的工具事件或状态变化时，activity 面板 MUST 实时增量更新，而不是仅在回合完成后刷新。
4. 右侧 activity 面板 MUST 能标识每条活动所属 session，并 SHOULD 呈现主从关系或来源标签，避免用户无法区分操作归属。
5. 切换到其他 workspace 或其他任务上下文后，面板 MUST 同步切换到对应的聚合数据上下文，不得继续混入上一个 workspace 的 session 活动。
6. 同一条命令、任务或文件修改在右侧 activity 面板、消息区工具卡片和底部 status panel 中 MUST 保持语义一致，不得出现明显摘要冲突。
7. 如果 AI 在执行过程中拉起子 session / 子 agent，右侧 activity 面板 MUST 将其活动并入聚合视图，而不是只显示主 session。
8. 对于文件修改事件，面板 MUST 至少展示文件路径与增删摘要，并 SHOULD 支持跳转到已有 diff / file view。
9. 对于命令执行事件，面板 MUST 至少展示命令摘要、运行状态与必要时的输出入口，但 MUST NOT 取代已有 runtime console。
10. 当当前 workspace 上下文尚无可展示的 session 操作时，右侧面板 MUST 提供清晰空态，说明尚未产生监控数据。
11. 现有 Git、File Tree、Search、Memory 等右侧面板能力 MUST 与变更前保持兼容，不得因新增 activity panel 回退。
12. 如果该能力通过 `SOLO` 视图模式进入，系统 MUST 提供明确入口（例如按钮），并 MUST 允许用户在 session 运行中切回普通视图。
13. 用户在运行中退出 `SOLO` 视图后，底层 session 执行 MUST 持续，系统 MUST NOT 因退出视图而中断命令、任务或文件修改流程。
14. 用户重新进入 `SOLO` 视图时，系统 SHOULD 恢复当前任务的 activity 上下文，而不是重置为初始空态。

## Spec Deliverables

- 新增 `codex-chat-canvas-workspace-session-activity-panel` delta spec，定义右侧多 session 聚合监控面板的范围、事件类型、状态语义与交互契约。
- 修改 `conversation-tool-card-persistence` delta spec，定义消息区 tool card 与右侧 activity panel 的摘要一致性和跳转复用要求。
- 修改 `codex-chat-canvas-execution-cards-visual-refactor` delta spec，定义 Codex 执行摘要规则在幕布实时标签、详情卡片、右侧 activity panel 三处共享。

## Impact

- Affected frontend:
  - `src/features/layout/components/PanelTabs.tsx`
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - `src/features/status-panel/hooks/useStatusPanelData.ts`
  - `src/features/threads/hooks/useThreads.ts`
  - `src/features/threads/hooks/useThreadSelectors.ts`
  - `src/features/messages/components/toolBlocks/*`
  - `src/features/threads/adapters/sharedRealtimeAdapter.ts`
  - 预期新增 `session activity panel` 相关组件、selector 与样式
- APIs / backend:
  - 优先不新增后端接口
  - 如发现当前实时 adapter 无法稳定产出所需事实，再补充最小事件归一化
- Systems:
  - 影响 chat canvas 右侧区域信息架构
  - 影响当前 session 的操作监控体验
  - 不影响已有 Git/runtime console 主能力边界

## Open Questions

- 文件修改进行中时，是否需要自动把目标文件在右侧 file/editor surface 中打开以形成“正在编辑”的可视反馈，还是仅在 activity panel 中提示并提供手动跳转。
