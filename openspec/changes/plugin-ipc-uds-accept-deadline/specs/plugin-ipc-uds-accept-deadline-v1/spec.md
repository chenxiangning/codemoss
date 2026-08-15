# plugin-ipc-uds-accept-deadline-v1 Spec Delta

## ADDED Requirements

### Requirement: UDS accept MUST finish within the handshake deadline

`accept_uds_timed` MUST 在 deadline 内完成 accept。无人连接 MUST `handshake-timeout`。

#### Scenario: a listener without a connector times out

- **WHEN** `accept_uds_timed` 在无人 connect 时等待
- **THEN** 它 MUST `handshake-timeout`
