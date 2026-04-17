## ADDED Requirements

### Requirement: Feishu Connector SHALL Reply Automatically via Engine Bridge

飞书连接器 MUST 支持基于引擎桥接的自动回发能力。

#### Scenario: auto reply uses selected engine output
- **WHEN** 会话已选择引擎且收到用户消息
- **THEN** 系统 MUST 将消息传递给所选引擎
- **AND** 系统 MUST 将引擎文本结果回发到飞书

#### Scenario: engine or reply failure is observable
- **WHEN** 引擎调用失败或飞书回发失败
- **THEN** 系统 MUST 记录失败审计与失败指标
- **AND** 用户 MUST 收到可读失败反馈（非静默失败）
