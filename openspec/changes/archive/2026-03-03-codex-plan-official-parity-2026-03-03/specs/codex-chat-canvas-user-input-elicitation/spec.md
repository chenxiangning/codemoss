## MODIFIED Requirements

### Requirement: RequestUserInput GUI Rendering

系统 MUST 将 `item/tool/requestUserInput` 事件渲染为可交互的用户输入卡片，并以 `completed` 生命周期驱动待处理队列。

#### Scenario: request user input event renders interactive card when not completed

- **WHEN** 客户端收到 `item/tool/requestUserInput` 事件
- **AND** 事件 `completed` 字段不存在或为 `false`
- **THEN** 幕布 MUST 渲染包含问题标题（`header`）、问题文本（`question`）、可选项（`options`）和备注输入的交互卡片
- **AND** 卡片 MUST 与当前 `thread_id` 绑定，不得跨线程显示

#### Scenario: completed request does not enter pending queue

- **WHEN** 客户端收到 `item/tool/requestUserInput` 事件
- **AND** 事件 `completed=true`
- **THEN** 该请求 MUST NOT 进入待处理队列
- **AND** 系统 MUST NOT 弹出交互卡片

#### Scenario: no-questions payload still renders submit path

- **WHEN** `requestUserInput` payload 中问题列表为空
- **THEN** 幕布 MUST 渲染空态提示
- **AND** 用户 MUST 仍可提交空 answers 响应

#### Scenario: thread isolation prevents cross-thread card leakage

- **WHEN** Thread A 收到 `requestUserInput` 事件
- **AND** 用户切换到 Thread B
- **THEN** Thread B 的消息流 MUST NOT 显示 Thread A 的 requestUserInput 卡片
- **AND** 切回 Thread A 后该卡片 MUST 仍然可见且保留之前的填写状态

### Requirement: User Input Response Roundtrip

系统 MUST 将用户输入结果通过标准响应通道回传给服务端，并在成功后更新本地队列状态。

#### Scenario: submit answers uses respond_to_server_request contract

- **WHEN** 用户在输入卡片点击提交
- **THEN** 客户端 MUST 调用 `respond_to_server_request`
- **AND** result payload MUST 符合 `{ answers: Record<string, { answers: string[] }> }`
- **AND** 提交成功后 MUST 从队列移除当前请求

#### Scenario: submit failure preserves request in queue

- **WHEN** 用户在输入卡片点击提交
- **AND** `respond_to_server_request` IPC 调用失败（网络异常、进程崩溃等）
- **THEN** 当前请求 MUST NOT 从队列移除
- **AND** 用户 MUST 能看到错误提示
- **AND** 用户 MUST 能重新点击提交

### Requirement: Mode-Blocked RequestUserInput Event Compatibility

系统 MUST 在策略明确阻断 `requestUserInput` 时发出兼容事件，供前端解释性展示与队列清理。

#### Scenario: blocked event includes actionable context with dual-case compatibility

- **GIVEN** `requestUserInput` 被策略层阻断
- **WHEN** 系统生成阻断反馈事件
- **THEN** 事件 MUST 包含 `threadId/thread_id`、`blockedMethod/blocked_method`、`effectiveMode/effective_mode` 与 `reason`
- **AND** MUST 包含可执行建议（例如切换模式）

#### Scenario: blocked event can remove pending request by id compatibility

- **GIVEN** 阻断事件携带 `requestId` 或 `request_id`
- **WHEN** 前端消费该事件
- **THEN** 前端 MUST 能识别两种命名并从待处理请求队列移除对应项
- **AND** 队列状态 MUST 保持线程隔离
