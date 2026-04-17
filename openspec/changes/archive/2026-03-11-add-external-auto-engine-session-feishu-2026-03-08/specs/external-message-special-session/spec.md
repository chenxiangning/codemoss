## ADDED Requirements

### Requirement: Special Session SHALL Support Automatic Engine Selection Handshake

特殊 session MUST 支持自动引擎选择握手流程。

#### Scenario: first inbound message creates auto session and asks engine choice
- **WHEN** 识别到该会话链路下的第一条入站消息
- **THEN** 系统 MUST 自动创建 special session
- **AND** 系统 MUST 自动回发“请选择 Codex 或 Claude Code”提示

#### Scenario: user selects engine from feishu chat
- **WHEN** 用户在飞书中回复 `codex/claude` 或 `1/2`
- **THEN** 系统 MUST 记录所选引擎并进入自动对话状态
- **AND** 系统 MUST 回发已切换确认消息

### Requirement: Special Session SHALL Route Follow-up Messages to Selected Engine Automatically

已完成引擎选择的特殊 session MUST 将后续消息自动路由到已选引擎，并将引擎回复自动回发到对应飞书会话。

#### Scenario: follow-up message gets automatic AI response
- **WHEN** 用户已完成引擎选择并继续发送消息
- **THEN** 系统 MUST 自动调用所选引擎生成回复
- **AND** 系统 MUST 将回复自动回发至飞书会话
