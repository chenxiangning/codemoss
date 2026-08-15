# plugin-ipc-uds-unlink-on-timeout-v1 Spec Delta

## ADDED Requirements

### Requirement: a timed-out UDS handshake MUST unlink the socket file

UDS / Worker handshake 在 connect、write 或 2s 读超时失败后 MUST 删除本次 socket 文件。

#### Scenario: a silent peer cannot leave a uds socket

- **WHEN** 对端 accept 后不写 ack
- **THEN** handshake MUST 超时失败
- **AND** 本次 socket 文件 MUST 不存在
