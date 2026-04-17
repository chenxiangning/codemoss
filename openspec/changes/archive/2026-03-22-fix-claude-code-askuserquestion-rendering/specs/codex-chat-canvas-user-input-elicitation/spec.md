## ADDED Requirements

### Requirement: Claude AskUserQuestion MUST Render Interactive RequestUserInput Card

系统 MUST 在 `claude` 会话收到 `item/tool/requestUserInput` 事件后，渲染可交互提问卡片，而不是仅展示原始 JSON 文本。

#### Scenario: claude request user input renders card instead of raw json
- **GIVEN** 当前活动会话引擎为 `claude`
- **WHEN** 客户端收到 `item/tool/requestUserInput` 且 `completed` 不存在或为 `false`
- **THEN** 幕布 MUST 渲染包含 `header`、`question`、`options` 与备注输入区的交互提问卡片
- **AND** 对应工具日志区 MUST NOT 作为唯一交互入口展示原始问题 JSON

#### Scenario: completed claude request does not enter pending card queue
- **GIVEN** 当前活动会话引擎为 `claude`
- **WHEN** 客户端收到 `item/tool/requestUserInput` 且 `completed=true`
- **THEN** 该请求 MUST NOT 进入待处理提问队列
- **AND** 系统 MUST NOT 渲染新的待提交提问卡片

#### Scenario: empty questions still keeps claude submit path
- **GIVEN** 当前活动会话引擎为 `claude`
- **WHEN** `requestUserInput` 事件中的 `questions=[]`
- **THEN** 幕布 MUST 显示空态提示
- **AND** 用户 MUST 仍可提交空 answers 响应

### Requirement: Claude RequestUserInput Submission MUST Reuse Standard Response Contract

系统 MUST 复用现有 `respond_to_server_request` 协议回传 Claude 提问答案，并在成功后清理待处理请求。

#### Scenario: claude submit routes through respond_to_server_request
- **GIVEN** 当前活动会话引擎为 `claude`
- **WHEN** 用户在提问卡片点击提交
- **THEN** 客户端 MUST 通过 `respond_to_server_request` 回传 `{ answers: Record<string, { answers: string[] }> }`
- **AND** 后端 MUST 继续将该响应路由到 Claude AskUserQuestion 恢复流程

#### Scenario: submit success removes pending request and records submitted summary
- **GIVEN** 当前活动会话引擎为 `claude`
- **WHEN** 提交响应成功
- **THEN** 当前 request MUST 从待处理队列移除
- **AND** 会话消息流 MUST 生成可追踪的已提交记录（`requestUserInputSubmitted` 或等效语义）

#### Scenario: submit failure keeps request for retry
- **GIVEN** 当前活动会话引擎为 `claude`
- **WHEN** 提交响应失败
- **THEN** 当前 request MUST 保留在待处理队列
- **AND** 用户 MUST 能看到错误提示并重试提交

### Requirement: Claude AskUserQuestion Tool Presentation MUST Avoid Misleading Plan-Mode Block Hint

当 Claude 提问链路可交互时，系统 MUST 避免展示与 Codex 协作模式阻断语义冲突的提示。

#### Scenario: active claude request does not show plan-mode-block hint as primary message
- **GIVEN** 当前活动会话引擎为 `claude`
- **AND** 存在可提交的 `requestUserInput` 卡片
- **WHEN** 对应 `askuserquestion` 工具日志可见
- **THEN** 用户主交互路径 MUST 指向提问卡片
- **AND** 界面 MUST NOT 以 `"This feature requires Plan mode"` 作为该请求的主提示文案

#### Scenario: claude tool row can remain as trace but not as exclusive interaction surface
- **GIVEN** 当前活动会话引擎为 `claude`
- **WHEN** `askuserquestion` 工具日志渲染
- **THEN** 工具行 MAY 保留为审计痕迹
- **AND** 用户 MUST 可在同线程中通过提问卡片完成回答与提交

### Requirement: Claude Fix MUST Preserve Other Engine Behavior

该能力变更 MUST 严格限制在 `claude` 引擎，不得改变其他引擎既有提问与工具展示行为。

#### Scenario: codex request user input flow remains unchanged
- **WHEN** 当前活动会话引擎为 `codex`
- **THEN** 既有 `requestUserInput` 渲染、提交与提示语义 MUST 保持不变

#### Scenario: opencode and gemini do not gain unintended askuserquestion behavior
- **WHEN** 当前活动会话引擎为 `opencode` 或 `gemini`
- **THEN** 系统 MUST NOT 因本变更引入新的 `askuserquestion` 交互流程
- **AND** 既有消息与工具渲染契约 MUST 保持不变
