# plugin-host-boot-uds-drain-v1 Spec Delta

## ADDED Requirements

### Requirement: a disabled boot supervisor MUST drain unexpected connectors

Unix `BootHost::drain_unexpected` MUST 抽干 backlog 里的连接。每条 MUST 回 `host-disabled`。MUST NOT 激活任何纤程。无连接 MUST `handshake-timeout`。

#### Scenario: two unexpected connectors are both rejected

- **WHEN** 两个客户端同时连上 boot supervisor
- **AND** 调用 `drain_unexpected`
- **THEN** 它 MUST 返回 2
- **AND** 两个客户端 MUST 都读到 `host-disabled`
- **AND** process / worker live_count MUST 都是 0

#### Scenario: drain without a connector times out

- **WHEN** 没有客户端
- **AND** 调用 `drain_unexpected`
- **THEN** 它 MUST `handshake-timeout`
