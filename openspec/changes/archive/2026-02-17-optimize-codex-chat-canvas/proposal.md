## Why

当前问题不是“协议能力缺失”，而是“用户感知断层”。

CodeMoss 在 Codex 路径已经具备：

- `collaborationMode/list`（模式列表）
- `turn/plan/updated`（计划更新）
- `item/tool/requestUserInput`（用户提问）

但用户在幕布层仍感知到：

- “Plan 模式不可切换”
- “ask-question 只有日志没有 GUI”
- “右侧 Plan 看不懂当前状态”

根因是入口可见性、语义映射和状态表达没有形成完整闭环。  
本提案目标是做一次低风险、可验证的 UX 收口：不改 Codex CLI 协议，只改 CodeMoss 客户端表达层。

## 目标与边界

### 目标

- 让 Codex 会话中的 Plan/Code 协作模式“可见、可切换、可验证”。
- 让 `requestUserInput` 流程“可理解、可回答、可回传、可排队”。
- 让 `turn/plan/updated` 在当前线程“稳定可见、状态一致、空态可解释”。

### 边界

- 仅作用于 Codex 对话幕布与相关状态链路。
- 不改 Codex CLI 上游协议。
- 不引入新的后端外部依赖。
- 不影响 Claude/OpenCode 现有体验。

## 非目标

- 不做多引擎统一壳层重构。
- 不改线程持久化结构与历史数据模型。
- 不做大规模视觉改版（仅做信息架构与交互收口）。

## Check 结果（现状核查）

### 已具备能力

- `collaborationMode/list` 调用链已打通。
- `turn/plan/updated` 已写入 `planByThread`。
- `requestUserInput` 已可通过 `respond_to_server_request` 提交。

### 关键断点

- 协作模式入口在开关关闭时直接消失，导致“功能不可见”。
- `askuserquestion`（工具名）与 `requestUserInput`（协议事件）语义不统一。
- Plan 面板空态缺少 Code/Plan/处理中三态语义区分。
- `is_secret` 在提案层缺少明确安全策略与验收标准。

## 技术方案对比

| 方案         | 描述                                 | 优点          | 缺点            | 结论  |
|------------|------------------------------------|-------------|---------------|-----|
| A. 文案补丁    | 仅修提示文案，不改入口与交互                     | 改动最小        | 无法解决入口隐藏和提问闭环 | 不选  |
| B. 幕布层最小闭环 | 保留现有数据流，增强入口可见性、语义映射、提问卡片与 Plan 空态 | 风险低、收益高、可测试 | 需补状态与回归用例     | 选用  |
| C. 全量壳层重构  | 重做消息壳层和右侧计划布局                      | 体验统一潜力高     | 周期长、回归面大      | 暂不选 |

取舍：先落 B，收敛“看不到/看不懂/答不成”，后续再评估视觉层迭代。

## 分阶段范围（Proposal 级）

### Phase 1（本次必须）

- 协作模式入口显式化（含关闭态引导）。
- `askuserquestion` 与 `requestUserInput` 语义映射。
- `requestUserInput` 提交闭环与队列可见。
- Plan 三态空态（Code 无计划 / Plan 等待 / Plan 空闲）。
- `is_secret` 默认掩码与日志脱敏策略。
- Codex 对话幕布实时展示大模型思考过程与状态信息（reasoning 过程可见、实时刷新、与消息流时间顺序一致）。

### Phase 2（后续可选）

- 在不改协议前提下优化提示文案和可视化层级。
- 观察真实使用数据后再做交互微调（不在本提案承诺范围内）。
- 将右侧 Plan 视图入口前置到编辑行：新增 `Plan` 按钮，点击弹出计划列表/概览，减少视线往返成本。
- 对 Codex 对话幕布中的执行卡片进行视觉重构：`File changes`、`运行命令`、`批量编辑文件` 三类卡片统一信息层级与可读性。
- 对全局编辑进度条进行交互补齐：文件项支持点击直达 diff、补齐 Plan 入口与计划进度（如 `1/2`）、修复“展开后无法关闭”问题。
- 对“批量运行”输出区做纵向排版重构：从横向挤压改为纵向记录流，并优化中英文混排可读性。
- 全局条升级为 Codex 专属活动条：聚合 Agent/Edit/Plan/Command 四类状态，并提供分段详情视图。

## What Changes

- 协作模式可见性：
    - Codex 幕布显式显示当前协作模式（Plan/Code）。
    - 开关关闭时入口保持可见、不可交互、可引导启用。
- 协作模式发送一致性：
    - 模式切换后下一次消息发送必须携带一致的 `collaborationMode` payload。
- 提问交互闭环：
    - 强化 `item/tool/requestUserInput` 卡片（问题、选项、备注、提交态、队列顺序）。
    - `answers` 通过 `respond_to_server_request` 回传，成功后队列移除。
    - `is_secret` 采用默认掩码并执行日志脱敏。
- 语义统一：
    - 工具展示层将 `askuserquestion` 统一解释为用户输入请求语义。
    - 明确提示 `Plan mode` 与 `update_plan`（checklist 工具）不是同一概念。
- Plan 可见性增强：
    - `turn/plan/updated` 与 Plan 面板对齐，按线程隔离，最新计划覆盖旧计划。
    - 空态细分为三类语义提示。
    - 编辑行集成 Plan 快捷入口：在编辑状态条（`编辑 x/y 文件` 行）放置 `Plan` 触发按钮，点击弹出计划列表（含步骤状态与进度摘要），支持一键定位到右侧
      Plan 面板。
- 执行卡片视觉重构：
    - `File changes` 卡片增加标题层级、状态标识与摘要区，减少大段日志直出。
    - `运行命令` 卡片强化命令头与输出区分层，支持失败焦点与高亮关键段。
    - `批量编辑文件` 卡片展示文件级汇总（新增/修改/删除 + 数量）与可折叠明细。
- 全局编辑进度条交互补齐：
    - 全局条中的编辑文件支持点击并跳转 Git tree diff。
    - 全局条补充 Plan 入口与计划进度摘要（`completed/total`）。
    - 全局条展开/收起支持可逆切换，避免“打开后无法关闭”。
- 批量运行输出可读性重构：
    - 批量运行子命令输出改为纵向展示，避免横向拼接。
    - 长文本采用稳定换行策略，减少拥挤与截断错读。
    - 成功/失败输出层级更清晰，便于快速定位异常。
- 模型思考过程实时可见（新增）：
    - 在 Codex 对话幕布实时展示 reasoning 增量内容与状态（进行中/完成）。
    - thinking 区域与最终回答保持时间顺序一致，避免“思考消失”或“先后错位”。
    - 兼容 `item.started/item.updated/item.completed` 中仅存在 `reasoning.text` 的载荷：当 `summary/content` 为空时，回填为 reasoning 正文，避免“只有标题没有正文”。
    - 仅 Codex 引擎启用，Claude/OpenCode 现有展示行为保持不变。
- 幕布语义强调样式减噪（新增）：
    - 将首段语义增强从“整块包边”调整为“左侧竖线强调 + 轻背景”。
    - 收敛 Codex reasoning 行边框密度，避免视觉污染。

## 验收矩阵（可执行）

| 能力                                                  | 必须通过的行为                                                  | 验收方式                            |
|-----------------------------------------------------|----------------------------------------------------------|---------------------------------|
| `codex-chat-canvas-collaboration-mode`              | Codex 下始终可见模式状态；开关关闭时 disabled 且可引导；切换后 payload 与 UI 一致  | 单测 + 集成测试 + 手动切换验证              |
| `codex-chat-canvas-user-input-elicitation`          | 收到 request 后可回答并提交；失败可重试；多请求 FIFO；`is_secret` 默认掩码       | 组件测试 + IPC 回传测试 + 手动链路验证        |
| `codex-chat-canvas-plan-visibility`                 | `turn/plan/updated` 按线程隔离；同线程新计划覆盖旧计划；空态三语义正确            | reducer/normalize 单测 + 线程切换场景验证 |
| `codex-chat-canvas-plan-visibility`（追加）             | 编辑行 `Plan` 入口可见；点击可弹出计划列表；列表内容与右侧 Plan 面板一致              | 组件测试 + 手动验收                     |
| `codex-chat-canvas-execution-cards-visual-refactor` | `File changes` / `运行命令` / `批量编辑文件` 卡片具备统一视觉层级、可读摘要和可折叠明细 | 组件测试 + 截图验收                     |
| `codex-chat-canvas-global-edit-progress`（追加）        | 全局编辑条文件可点击直达 diff；含 Plan 入口和 `1/2` 进度；展开/收起可逆            | 组件测试 + 交互回归 + 手动验收              |
| `codex-chat-canvas-batch-run-readability`（追加）       | 批量运行输出改为纵向阅读流；长文本排版稳定；错误信息可快速识别                          | 组件测试 + 样式回归 + 手动验收              |
| `codex-chat-canvas-reasoning-stream-visibility`（新增） | Codex 幕布可实时看到模型 thinking 过程与状态；增量内容连续、顺序正确、不闪烁丢失         | 组件测试 + 流式事件回放测试 + 手动验收          |
| `codex-chat-canvas-reasoning-stream-visibility`（补充） | 当上游只返回 `reasoning.text`（无 `summary/content` 增量）时，幕布仍展示 thinking 正文 | item 转换单测 + 回放验证                  |
| `codex-chat-canvas-reasoning-stream-visibility`（追加） | 不做前端思考标题翻译；语义强调由整块包边改为左侧竖线，降低视觉噪声                        | UI 组件测试 + 样式截图验收                |

## 验收标准

- 模式可见与可切换：
    - Codex 会话中始终可见协作模式状态。
    - 模式切换后发送 payload 与 UI 选中状态一致。
- 提问可回答与可回传：
    - 收到 `item/tool/requestUserInput` 后用户可完成回答并提交。
    - 回传 payload 符合 `answers` 结构，提交后队列正确前移。
- 语义一致：
    - `askuserquestion` 展示语义与 `requestUserInput` 对齐。
    - 用户可从 UI 文案区分 Plan mode 与 `update_plan`。
- 计划可见性一致：
    - `turn/plan/updated` 到达后当前线程 Plan 区域即时更新。
    - 步骤状态稳定归一（`pending/inProgress/completed`），进度摘要与步骤一致。
- 回归约束：
    - Claude/OpenCode 路径行为不变。
    - TypeScript 检查与相关前端测试通过。

## 里程碑与 Go/No-Go

| 里程碑            | 范围                                        | Go 条件（全部满足）                                  | No-Go 触发（任一触发）                         |
|----------------|-------------------------------------------|----------------------------------------------|----------------------------------------|
| M1 协作模式可见性     | 入口显式化、关闭态引导、payload 一致性                   | Codex 下入口可见；关闭态 disabled；切换后 payload 与 UI 一致 | 非 Codex 引擎出现协作模式 UI；payload 与 UI 选中不一致 |
| M2 提问交互闭环      | request 渲染、提交回传、FIFO、`is_secret`          | 提交成功后出队；失败可重试；`is_secret` 默认掩码且可切换           | 提交失败后请求被错误移除；出现敏感明文输出                  |
| M3 Plan 可见性    | 线程隔离、最新覆盖、三态空态、状态归一化                      | `turn/plan/updated` 即时生效；跨线程不串扰；空态语义正确       | 线程切换后显示串线；未知状态导致 UI 异常或进度错误            |
| M4 发布门禁        | Codex 验收 + 跨引擎回归 + 质量检查                   | A1-A10 与 B1-B4 清单通过；`typecheck` + 目标测试通过     | 任一高风险回归未关闭仍计划上线                        |
| M5 Plan 快览入口   | 编辑行 Plan 入口 + popover 快览 + 同源同步           | 编辑行可一键打开计划快览；与右侧 Plan 面板同源一致；跨线程不串扰          | 快览与右侧面板数据不一致；切线程后出现陈旧计划                |
| M6 执行卡片视觉重构    | `File changes` / `运行命令` / `批量编辑文件` 三类卡片重构 | 三类卡片统一骨架与状态语义；可读摘要与折叠明细可用；相关测试通过             | 布局跳变影响阅读；失败态不可快速定位；回归未通过               |
| M8 全局编辑进度条交互闭环 | 全局编辑条 diff 直达 + Plan 信息 + 展开收起修复          | 文件可直达 diff；Plan 信息完整；展开/收起可逆且无串扰             | 文件点击无响应；缺少 Plan/进度；全局条出现常开锁死           |
| M9 批量运行纵向排版    | 批量运行输出纵向化 + 文本可读性优化                       | 输出为纵向记录流；长文本不横向挤压；错误层级清晰                     | 输出继续横向铺开；长文本难读；错误不易定位                  |

### 上线门槛（Final Go）

- 必须：M1-M6 全部达到 Go。
- 必须：无 P0/P1 未关闭风险项。
- 必须：不引入协议变更，不涉及数据迁移。

## Capabilities

### New Capabilities

- `codex-chat-canvas-collaboration-mode`: Codex 对话幕布中的 Plan/Code 模式显式切换、状态提示与发送链路一致性。
- `codex-chat-canvas-user-input-elicitation`: Codex 对话幕布中的 `requestUserInput` 交互卡片、提交流程与队列可见性。
- `codex-chat-canvas-plan-visibility`: Codex 对话幕布中 `turn/plan/updated` 与 Plan 面板的可见性与状态一致性契约。
- `codex-chat-canvas-execution-cards-visual-refactor`: Codex 对话幕布中的执行类卡片（`File changes`、`运行命令`、`批量编辑文件`
  ）视觉信息架构统一与可读性增强。
- `codex-chat-canvas-global-edit-progress`: Codex 对话幕布全局编辑进度条的 diff 跳转、Plan 信息展示与展开收起交互闭环。
- `codex-chat-canvas-batch-run-readability`: Codex 对话幕布中“批量运行”输出区的纵向布局与文本可读性优化能力。
- `codex-chat-canvas-reasoning-stream-visibility`: Codex 对话幕布中大模型思考过程（reasoning）实时可见与状态同步能力。

### Modified Capabilities

- (none): 本提案不修改现有 capability requirement，全部为新增 capability。

## Impact

- 前端影响域：`App.tsx`、`features/collaboration/**`、`features/messages/**`、`features/threads/**`、`features/plan/**`。
- 前端影响域（追加）：对话幕布执行卡片组件与样式层（执行日志卡片、文件变更卡片、批量编辑卡片）。
- i18n：补充 Codex 幕布术语一致性文案（Plan mode / update_plan / requestUserInput）。
- 测试：新增协作模式可见性、提问闭环、语义映射、Plan 可见性与跨引擎不回归测试。

## 风险与回滚

### 主要风险

- 入口显式化后用户误以为所有能力默认可用。
- 敏感输入渲染处理不当导致信息暴露。
- Codex 专属改动外溢到其他引擎。

### 风险应对

- 开关关闭时使用 disabled 态 + 清晰引导，不做静默失败。
- `is_secret` 默认掩码 + 调试日志脱敏。
- 严格 `activeEngine === "codex"` 门控 + 跨引擎回归。

### 回滚触发条件与策略

- 触发条件：
    - 出现跨引擎 UI 回归。
    - 出现敏感字段明文泄露风险。
    - 提问链路提交失败率异常升高。
- 回滚策略：
    - 本变更为客户端增量逻辑，不涉及数据迁移。
    - 可按组件级或 capability 级快速回退。
