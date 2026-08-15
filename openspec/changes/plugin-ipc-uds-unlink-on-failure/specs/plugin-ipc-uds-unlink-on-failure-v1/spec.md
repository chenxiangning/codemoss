# plugin-ipc-uds-unlink-on-failure-v1 Spec Delta

## ADDED Requirements

### Requirement: a failed UDS handshake MUST unlink the socket file

UDS / Worker handshake 无论成功或失败 MUST 删除本次 socket 文件。错 nonce 之后该 path MUST 不存在。

#### Scenario: a bad nonce cannot leave a uds socket

- **WHEN** UDS handshake ack 回错 nonce
- **THEN** 激活 MUST 失败
- **AND** 本次 socket 文件 MUST 不存在
