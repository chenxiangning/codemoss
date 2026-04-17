# codex-chat-canvas-collaboration-mode Specification

ADDED by change: optimize-codex-chat-canvas

## Purpose

为 Codex 对话幕布提供可见、可切换、可解释的 Plan/Code 协作模式体验，确保模式状态与发送参数一致。

## ADDED Requirements

### Requirement: Collaboration Mode Visibility in Codex Canvas

系统 MUST 在 Codex 对话幕布中显式展示当前协作模式状态。

#### Scenario: current collaboration mode is visible in codex canvas

- **WHEN** 当前活动引擎为 `codex`
- **THEN** 幕布 MUST 显示当前协作模式标识（Plan 或 Code）
- **AND** 该标识 MUST 与当前 `selectedCollaborationModeId` 一致

#### Scenario: collaboration mode entry remains visible when feature is disabled

- **WHEN** 当前活动引擎为 `codex`
- **AND** 协作模式功能开关（`experimentalCollaborationModesEnabled`）处于关闭状态
- **THEN** 幕布中的协作模式区域 MUST 仍然可见
- **AND** 该区域 MUST 呈现不可交互态（`disabled`）并提供启用引导文案
- **AND** 下拉选择控件 MUST 设置 `disabled` 属性，阻止用户交互

#### Scenario: disabled collaboration mode area provides settings jump

- **WHEN** 当前活动引擎为 `codex`
- **AND** 协作模式功能开关处于关闭状态
- **AND** 用户点击 disabled 态的协作模式区域或引导文案
- **THEN** 系统 MUST 跳转至 Settings 页面的实验功能区域
- **AND** 跳转后用户 MUST 能直接看到并操作 `experimentalCollaborationModesEnabled` 开关

#### Scenario: collaboration mode UI is hidden for non-codex engines

- **WHEN** 当前活动引擎为 `claude` 或 `opencode`
- **THEN** 幕布中 MUST NOT 显示任何协作模式相关 UI 元素
- **AND** 引擎切换到 `codex` 后协作模式 UI MUST 立即出现

#### Scenario: disabled collaboration mode elements are keyboard inaccessible

- **WHEN** 协作模式功能开关处于关闭状态
- **THEN** disabled 态的交互元素 MUST 设置 `tabIndex={-1}` 和 `aria-disabled="true"`
- **AND** 键盘导航 MUST NOT 聚焦到 disabled 态的选择控件

### Requirement: Collaboration Mode Switch Consistency

系统 MUST 保证幕布模式切换结果与发送链路参数一致。

#### Scenario: mode switch updates outbound collaborationMode payload

- **WHEN** 用户在 Codex 幕布将模式从 `code` 切换到 `plan`
- **THEN** 下一次 `send_user_message` 请求 MUST 携带 `collaborationMode.mode = "plan"`
- **AND** payload 中的 settings MUST 与当前模型/effort 解析结果一致

#### Scenario: mode cycle shortcut reflects current mode

- **WHEN** 用户触发协作模式循环操作（菜单或快捷键）
- **THEN** 当前模式 MUST 在幕布状态显示中立即更新
- **AND** 更新结果 MUST 与下拉选项中的当前值一致

#### Scenario: rapid mode toggle preserves final state in payload

- **WHEN** 用户快速连续切换模式（如 Plan→Code→Plan）
- **AND** 在最终切换后立即发送消息
- **THEN** `send_user_message` payload 中的 `collaborationMode.mode` MUST 反映最终选中状态
- **AND** 不得出现竞态导致 payload 与 UI 显示不一致

#### Scenario: shortcut is null when feature is disabled

- **WHEN** 协作模式功能开关处于关闭状态
- **THEN** 协作模式循环快捷键 MUST 为 `null`（无注册）
- **AND** 用户按下该快捷键组合 MUST 无任何响应

### Requirement: Plan Mode Semantics Hint

系统 MUST 明确区分 Plan mode 与 `update_plan` 工具语义。

#### Scenario: user sees plan mode vs update_plan clarification

- **WHEN** 当前活动引擎为 `codex`
- **AND** 用户进入或切换到 Plan 模式
- **THEN** 幕布 MUST 提供语义提示，说明 Plan mode 不是 `update_plan` checklist 工具
- **AND** 提示文案 MUST 不要求用户理解底层协议实现细节

#### Scenario: plan mode hint clarifies requestUserInput availability

- **WHEN** 用户切换到 Plan 模式
- **THEN** 语义提示 SHOULD 包含 `requestUserInput`（用户提问）功能仅在 Plan 模式下可用的说明
- **AND** 该提示 MUST 使用用户友好术语而非协议术语

### Requirement: Engine Gating

所有协作模式 UI 改动 MUST 严格按引擎类型门控。

#### Scenario: codex-only rendering does not affect claude engine

- **GIVEN** 协作模式 UI 的所有渲染条件包含 `activeEngine === "codex"` 门控
- **WHEN** 当前活动引擎为 `claude`
- **THEN** 所有协作模式相关的 DOM 元素 MUST NOT 被渲染
- **AND** 无论功能开关状态如何，claude 引擎下协作模式 UI MUST 保持不可见

#### Scenario: engine switch cleans up stale collaboration mode UI

- **WHEN** 用户从 `codex` 引擎切换到 `claude` 引擎
- **THEN** 协作模式 UI 元素 MUST 立即从 DOM 中移除
- **AND** 不得有残留的 disabled 态、引导文案或选择控件
