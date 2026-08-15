# plugin-host-boot-uds-reject-v1 Spec Delta

## ADDED Requirements

### Requirement: a disabled boot supervisor MUST reject unexpected connectors

Unix `BootHost::reject_unexpected` MUST 在 handshake deadline 内 accept。收到连接 MUST 回 `host-disabled` 并断开，MUST NOT 激活任何纤程。无连接 MUST `handshake-timeout`，supervisor socket MUST 仍存在。

#### Scenario: an unexpected connector is rejected without activation

- **WHEN** 客户端连上 boot supervisor
- **AND** 调用 `reject_unexpected`
- **THEN** 客户端 MUST 读到 `host-disabled`
- **AND** process / worker live_count MUST 都是 0

#### Scenario: reject without a connector times out

- **WHEN** 没有客户端
- **AND** 调用 `reject_unexpected`
- **THEN** 它 MUST `handshake-timeout`
- **AND** supervisor path MUST 仍存在
