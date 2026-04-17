## ADDED Requirements

### Requirement: Codex Queued Follow-up Fusion SHALL Preserve Collaboration Payload Stability

在 Codex 会话中，排队消息融合 MUST 复用当前线程已解析的 collaboration payload，并保持默认 mode 选择稳定。

#### Scenario: queued codex item reuses current collaboration payload
- **GIVEN** 当前活动引擎为 `codex`
- **AND** 当前线程存在已解析的 collaboration payload
- **WHEN** 用户执行排队消息融合
- **THEN** 系统 MUST 以当前线程已解析的 collaboration payload 发送该条消息
- **AND** 系统 MUST NOT 因融合动作重置或覆盖该 payload

#### Scenario: fused codex item does not mutate default collaboration mode
- **GIVEN** 当前活动引擎为 `codex`
- **AND** 当前线程存在既定的 collaboration mode 选择
- **WHEN** 用户执行排队消息融合
- **THEN** 系统 MUST NOT 将该动作解释为默认 collaboration mode 切换
- **AND** 该线程后续普通发送的默认 mode 语义 MUST 保持不变
