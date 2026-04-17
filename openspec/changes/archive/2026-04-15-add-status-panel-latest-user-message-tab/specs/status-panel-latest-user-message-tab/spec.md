## ADDED Requirements

### Requirement: Dock Status Panel MUST Expose Latest User Message Tab Across Supported Engines

系统 MUST 在右下角 `dock` 状态面板中提供 `最新用户对话` Tab，并在当前已接入底部状态面板的 `Claude / Codex / Gemini` 会话中保持一致可见。

#### Scenario: dock panel shows latest user message tab for supported engines

- **WHEN** 用户进入使用底部 `dock` 状态面板的 `Claude`、`Codex` 或 `Gemini` 会话
- **THEN** 状态面板 MUST 展示 `最新用户对话` Tab
- **AND** 该 Tab MUST 与既有 `任务 / 子代理 / 编辑 / Plan` Tab 并列存在

#### Scenario: existing tabs remain reachable after adding latest user message tab

- **WHEN** 系统新增 `最新用户对话` Tab 后
- **THEN** 既有 `任务 / 子代理 / 编辑 / Plan` Tab MUST 保持原有访问方式
- **AND** 新 Tab MUST NOT 替代或隐藏现有状态面板能力

### Requirement: Latest User Message Tab MUST Remain Manual-Entry Only

系统 MUST 将 `最新用户对话` 定义为手动查看入口，不得因新的用户消息、assistant 流式输出或线程恢复而自动切换到该 Tab。

#### Scenario: new user message does not auto-switch active tab

- **WHEN** 当前线程产生新的用户消息
- **THEN** 系统 MUST 更新 `最新用户对话` Tab 的内容来源
- **AND** MUST NOT 自动把状态面板切换到 `最新用户对话` Tab

#### Scenario: reopening or restoring thread does not steal current tab focus

- **WHEN** 用户重开线程或线程历史恢复
- **THEN** 状态面板 MUST 维持当前 Tab 选择语义
- **AND** MUST NOT 因存在最新用户消息而抢占当前已打开的其他 Tab

### Requirement: Latest User Message Preview MUST Reflect Current Thread And Preserve Image Hints

系统 MUST 只展示当前 active thread 的最后一条用户消息，并在消息带有图片时显示数量占位摘要；非图片附件类型不属于本次 capability 的强制范围。

#### Scenario: latest text-only user message is shown as preview content

- **WHEN** 当前线程最后一条用户消息仅包含文本
- **THEN** `最新用户对话` Tab MUST 展示该文本内容
- **AND** 不得混入更早的用户消息或 assistant 消息内容

#### Scenario: latest user message with images includes count placeholder

- **WHEN** 当前线程最后一条用户消息包含 `1` 张或多张图片
- **THEN** `最新用户对话` Tab MUST 展示该条消息文本
- **AND** MUST 同时展示图片数量占位信息，例如 `含 2 张图片` 或等效本地化表达

#### Scenario: latest user message without text but with images still remains informative

- **WHEN** 当前线程最后一条用户消息没有文本但包含图片
- **THEN** `最新用户对话` Tab MUST 至少展示图片数量占位信息
- **AND** MUST NOT 退化为空态

#### Scenario: preview scope follows active thread only

- **WHEN** 用户切换到另一个 thread
- **THEN** `最新用户对话` Tab MUST 切换为新 active thread 的最后一条用户消息
- **AND** 不得显示前一个 thread 的残留内容

### Requirement: Latest User Message Tab MUST Support Four-Line Preview With Explicit Expansion

系统 MUST 对超长内容先展示前 `4` 行预览，并提供显式的 `展开 / 收起` 交互，完整内容仅在面板内部查看。

#### Scenario: long message is limited to first four lines by default

- **WHEN** 最后一条用户消息超出默认预览长度
- **THEN** `最新用户对话` Tab MUST 默认只展示前 `4` 行内容
- **AND** 截断后的内容 MUST 仍保持可读，不得破坏基础换行语义

#### Scenario: user can expand and collapse long message content

- **WHEN** 用户点击 `展开`
- **THEN** 状态面板 MUST 展示该条用户消息的完整内容
- **AND** 用户后续 MUST 可以通过 `收起` 回到默认预览态

### Requirement: Latest User Message Tab MUST Provide Stable Empty State

当当前 active thread 尚无可展示的用户消息时，系统 MUST 提供稳定空态。

#### Scenario: thread without user message shows empty state

- **WHEN** 当前 active thread 不存在任何用户消息
- **THEN** `最新用户对话` Tab MUST 显示 `暂无用户对话`
- **AND** MUST NOT 展示旧线程残留文本或无意义占位内容

### Requirement: First Phase MUST Stay Dock-Scoped And Backward Compatible

该能力第一阶段 MUST 严格限制在右下角 `dock` 状态面板，并保持既有状态面板默认行为向后兼容。

#### Scenario: popover status panel does not gain latest user message tab in phase one

- **WHEN** 用户使用输入框上方的 popover 状态面板
- **THEN** 系统 MUST NOT 在该形态下新增 `最新用户对话` Tab
- **AND** 该限制 MUST 视为第一阶段的明确边界

#### Scenario: existing default tab strategy remains unchanged

- **WHEN** 系统接入 `最新用户对话` Tab 后
- **THEN** 状态面板默认激活 Tab 策略 MUST 保持原有行为
- **AND** 新能力 MUST 作为附加入口存在，而不是改变默认打开页
