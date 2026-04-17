## MODIFIED Requirements

### Requirement: RequestUserInput GUI Rendering

系统 MUST 将 `item/tool/requestUserInput` 事件渲染为可交互的用户输入卡片，并在实时与历史恢复场景使用统一队列语义。

#### Scenario: request user input event renders interactive card

- **WHEN** 客户端收到 `item/tool/requestUserInput` 事件
- **THEN** 幕布 MUST 渲染包含问题标题（`header`）、问题文本（`question`）、可选项（`options`）和备注输入的交互卡片
- **AND** 卡片 MUST 与当前 `thread_id` 绑定，不得跨线程显示

#### Scenario: no-questions payload still renders submit path

- **WHEN** `requestUserInput` payload 中问题列表为空
- **THEN** 幕布 MUST 渲染空态提示
- **AND** 用户 MUST 仍可提交空 answers 响应

#### Scenario: card renders isOther field with dual compatibility

- **WHEN** `requestUserInput` 问题项携带 `isOther` 或 `is_other` 字段
- **THEN** 客户端 MUST 将两种命名归一化为 `isOther: boolean`
- **AND** 当 `isOther=true` 时，MUST 渲染自由文本输入框供用户输入自定义答案

#### Scenario: thread isolation prevents cross-thread card leakage

- **WHEN** Thread A 收到 `requestUserInput` 事件
- **AND** 用户切换到 Thread B
- **THEN** Thread B 的消息流 MUST NOT 显示 Thread A 的 requestUserInput 卡片
- **AND** 切回 Thread A 后该卡片 MUST 仍然可见且保留之前的填写状态

#### Scenario: unresolved request remains visible after history restoration

- **GIVEN** 某线程存在未提交的 `requestUserInput` 请求
- **WHEN** 用户重启后恢复该线程历史
- **THEN** 幕布 MUST 继续展示该未完成请求
- **AND** 其线程绑定与顺序语义 MUST 与实时路径一致

### Requirement: User Input Response Roundtrip

系统 MUST 将用户输入结果通过标准响应通道回传给服务端，并在统一队列中保持幂等与顺序一致。

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

#### Scenario: queued requests are processed in order per thread

- **WHEN** 同一线程存在多个待处理 `requestUserInput` 请求
- **THEN** 幕布 MUST 按接收顺序逐个展示（FIFO）
- **AND** 未提交当前请求前 MUST NOT 自动跳转到下一个请求

#### Scenario: queue depth indicator shows pending count

- **WHEN** 同一线程存在 N 个（N > 1）待处理 `requestUserInput` 请求
- **THEN** 当前展示的卡片 MUST 显示队列深度指示（如 `"1 of N"`）
- **AND** 提交当前请求后指示器 MUST 更新为 `"1 of N-1"`

#### Scenario: duplicate request is deduplicated by workspace and request id

- **WHEN** 同一 `(workspace_id, request_id)` 组合的 `requestUserInput` 事件被重复接收
- **THEN** 队列中 MUST NOT 出现重复的请求
- **AND** 已存在的请求 MUST 保持其原始队列位置

#### Scenario: history replay keeps queue order and dedup semantics

- **GIVEN** 线程中存在多个 request，且包含重连后的重复事件
- **WHEN** 历史恢复并继续接收实时事件
- **THEN** 队列顺序 MUST 保持 FIFO
- **AND** 去重规则 MUST 与实时路径完全一致

### Requirement: askuserquestion Semantic Mapping

系统 MUST 在工具展示层将 `askuserquestion` 与 `requestUserInput` 语义对齐，并保证统一渲染语义不会因引擎差异漂移。

#### Scenario: tool log alias maps to user input request semantics

- **WHEN** 工具日志中出现 `askuserquestion` 工具名
- **THEN** 幕布 MUST 将展示名映射为 `"User Input Request"` 或等效本地化术语
- **AND** 用户 MUST 能理解该事件属于“需要用户回答”的流程而非普通日志

#### Scenario: askuserquestion in code mode shows plan mode hint

- **WHEN** 工具日志中出现 `askuserquestion` 工具名
- **AND** 当前协作模式为 Code（Default）
- **THEN** 工具展示区域 MUST 追加提示：`"This feature requires Plan mode"`
- **AND** 该提示 MUST 帮助用户理解为什么没有看到交互卡片
