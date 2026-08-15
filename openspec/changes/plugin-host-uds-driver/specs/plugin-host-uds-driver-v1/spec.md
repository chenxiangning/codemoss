# plugin-host-uds-driver-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MAY complete handshake over UDS without spawning a process

当 Host 使用 `UdsHandshakeDriver` 时，每个 required entry 的 `start` MUST 在注入 UDS 上完成 MXPC hello/ack。nonce 不匹配 MUST 使该 entry 失败并回滚已启动 entry。本 driver MUST NOT spawn OS 子进程。

#### Scenario: notes unit becomes ready over UDS

- **WHEN** enabled Host 用 UdsHandshakeDriver 激活 `notes-main`
- **THEN** slot state MUST 为 `ready`

#### Scenario: bad nonce rolls back earlier entries

- **WHEN** 第二 entry 的 ack nonce 不匹配
- **THEN** slot MUST 为 `failed`
- **AND** 第一 entry MUST 被 stop
