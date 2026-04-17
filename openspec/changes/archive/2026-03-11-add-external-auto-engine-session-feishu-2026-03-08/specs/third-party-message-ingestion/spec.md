## ADDED Requirements

### Requirement: Inbound Message Flow SHALL Support Auto Processing

系统 MUST 支持对飞书入站消息执行自动处理流，而无需用户在 CodeMoss 页面点击“发送回复”。

#### Scenario: new inbound message triggers auto flow
- **WHEN** 系统接收到一条新的（去重后）飞书入站消息
- **THEN** 系统 MUST 自动触发外部会话处理流程
- **AND** 系统 MUST 记录自动处理的审计信息与指标

#### Scenario: duplicated inbound message does not trigger repeated auto reply
- **WHEN** 系统接收到已处理过的重复消息
- **THEN** 系统 MUST NOT 重复执行自动回复
- **AND** 系统 MUST 保持幂等结果
