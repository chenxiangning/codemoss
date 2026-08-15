# plugin-ipc-uds-connect-deadline-v1 Spec Delta

## ADDED Requirements

### Requirement: UDS connect MUST complete within the handshake deadline

`connect_uds_timed` MUST 在给定 deadline 内完成。listener 不 accept / backlog 满 MUST 在 deadline 内 fail closed（`handshake-timeout` 或 `transport`）。UDS / Worker handshake MUST 用 timed connect。`/tmp` 与 0755 父目录仍 MUST `permission-denied`。

#### Scenario: a listener that never accepts cannot complete connect

- **WHEN** socket 已 bind
- **AND** listener 不 accept 且 backlog 被填满
- **THEN** 后续 `connect_uds_timed` MUST 在 deadline 内失败
- **AND** 错误 MUST 是 `handshake-timeout` 或 `transport`
