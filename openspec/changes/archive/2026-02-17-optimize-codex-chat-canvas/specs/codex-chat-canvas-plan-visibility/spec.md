# codex-chat-canvas-plan-visibility Specification

ADDED by change: optimize-codex-chat-canvas

## Purpose

确保 Codex `turn/plan/updated` 事件在对话幕布中稳定可见，并在计划未产出与计划更新阶段提供清晰反馈。

## ADDED Requirements

### Requirement: Plan Update Synchronization by Thread

系统 MUST 将 `turn/plan/updated` 事件同步到当前线程的 Plan 展示区域。

#### Scenario: plan update writes to active thread plan state

- **WHEN** 客户端收到 `turn/plan/updated` 事件
- **THEN** 系统 MUST 将 `explanation + plan steps` 写入对应 `threadId` 的计划状态
- **AND** 不同线程的计划状态 MUST 相互隔离

#### Scenario: latest turn plan replaces stale plan for same thread

- **WHEN** 同一线程收到新的 `turn/plan/updated`
- **THEN** 新计划 MUST 完整覆盖旧计划显示（非合并）
- **AND** 显示内容 MUST 以最新 turn 为准

#### Scenario: thread switch displays correct thread plan

- **WHEN** Thread A 有活跃计划
- **AND** Thread B 有不同的活跃计划
- **AND** 用户从 Thread A 切换到 Thread B
- **THEN** Plan 面板 MUST 立即显示 Thread B 的计划
- **AND** Thread A 的计划 MUST NOT 在 Thread B 的面板中可见

#### Scenario: thread switch to planless thread shows empty state

- **WHEN** Thread A 有活跃计划
- **AND** Thread B 无计划
- **AND** 用户从 Thread A 切换到 Thread B
- **THEN** Plan 面板 MUST 显示对应的空态语义提示（取决于当前协作模式和处理状态）

### Requirement: Plan Panel Empty and Waiting Semantics

系统 MUST 提供可区分的计划空态三种语义。

#### Scenario: code mode empty message shown when not in plan mode

- **WHEN** 当前协作模式为 Code（Default）
- **AND** 当前线程无有效计划
- **THEN** Plan 区域 MUST 显示 `"Switch to Plan mode to enable planning"` 或等效提示
- **AND** 该提示 MUST 引导用户切换到 Plan 模式

#### Scenario: waiting message shown while processing without plan in plan mode

- **WHEN** 当前协作模式为 Plan
- **AND** 线程处于处理中（`isProcessing = true`）
- **AND** 当前线程尚未收到任何有效计划
- **THEN** Plan 区域 MUST 显示等待语义提示（如 `"Generating plan..."`）

#### Scenario: idle empty message shown when no active plan in plan mode

- **WHEN** 当前协作模式为 Plan
- **AND** 线程不在处理中（`isProcessing = false`）
- **AND** 当前线程无有效计划
- **THEN** Plan 区域 MUST 显示空态语义提示（如 `"No plan generated. Send a message to start."`）

#### Scenario: plan panel receives isPlanMode prop from parent

- **WHEN** PlanPanel 组件被渲染
- **THEN** 父组件 MUST 传递 `isPlanMode: boolean` prop（来源于 `selectedCollaborationMode?.mode === "plan"`）
- **AND** PlanPanel MUST 基于 `isPlanMode` + `isProcessing` 两个维度决定空态文案

### Requirement: Plan Step Status Normalization

系统 MUST 统一计划步骤状态枚举并稳定渲染。

#### Scenario: incoming plan statuses normalize to supported set

- **WHEN** 收到计划步骤状态值
- **THEN** 客户端 MUST 归一化为 `pending`、`inProgress`、`completed`
- **AND** 非法或未知状态 MUST 回退到 `pending`

#### Scenario: snake_case status values are normalized

- **WHEN** 上游事件中步骤状态以 `in_progress`（snake_case）格式到达
- **THEN** 客户端 MUST 将其归一化为 `inProgress`（camelCase）
- **AND** 归一化逻辑 MUST 不区分大小写

#### Scenario: null or undefined status falls back to pending

- **WHEN** 收到计划步骤且状态值为 `null`、`undefined` 或空字符串
- **THEN** 客户端 MUST 将该步骤状态设置为 `pending`
- **AND** 步骤 MUST 正常渲染，不得抛出错误

#### Scenario: progress summary reflects normalized step statuses

- **WHEN** 计划步骤列表包含已归一化状态
- **THEN** Plan 区域 MUST 按 `completed / total` 展示进度摘要
- **AND** 摘要结果 MUST 与步骤状态渲染一致
- **AND** 进度摘要计算 MUST 仅统计 `completed` 状态的步骤为分子

### Requirement: Plan Panel Collapsed State Accessibility

折叠态的 Plan 面板中交互元素 MUST 不影响键盘可访问性。

#### Scenario: collapsed plan panel hides interactive elements from tab order

- **WHEN** Plan 面板处于折叠态（CSS `display:none`）
- **AND** 面板内包含可交互元素（按钮、链接等）
- **THEN** 这些元素 MUST 设置 `tabIndex={-1}` 和 `aria-hidden="true"`
- **AND** 键盘 Tab 导航 MUST NOT 聚焦到这些被隐藏的元素

### Requirement: Plan Quick Entry in Edit Row

系统 MUST 在编辑状态行提供可发现的 Plan 快速入口，并在不离开当前上下文的前提下展示计划快览。

#### Scenario: edit row shows plan button in editing context

- **WHEN** 用户处于编辑态（显示 `编辑 x / y 文件` 行）
- **THEN** 编辑行 MUST 显示 `Plan` 入口按钮
- **AND** 入口按钮 SHOULD 显示当前计划进度摘要（如 `completed/total`）

#### Scenario: clicking plan button opens plan popover list

- **WHEN** 用户点击编辑行的 `Plan` 按钮
- **THEN** 系统 MUST 打开计划快览弹层（popover）
- **AND** 弹层 MUST 展示当前线程计划步骤列表与状态
- **AND** 弹层内容 MUST 与右侧 Plan 面板使用同一数据源

#### Scenario: popover content stays in sync with right panel

- **WHEN** 当前线程收到新的 `turn/plan/updated`
- **THEN** 计划快览弹层与右侧 Plan 面板 MUST 同步更新
- **AND** 两者 MUST NOT 出现不同步或陈旧内容

#### Scenario: no plan state in popover uses same semantics

- **WHEN** 当前线程无有效计划
- **THEN** 计划快览弹层 MUST 使用与 Plan 面板一致的空态/等待态语义
- **AND** 不得展示历史线程的残留计划数据

#### Scenario: popover provides deep-link to full plan panel

- **WHEN** 用户在计划快览弹层中执行“查看完整计划”
- **THEN** 系统 MUST 聚焦或展开右侧 Plan 面板
- **AND** 用户上下文（当前线程、当前计划）MUST 保持不变
