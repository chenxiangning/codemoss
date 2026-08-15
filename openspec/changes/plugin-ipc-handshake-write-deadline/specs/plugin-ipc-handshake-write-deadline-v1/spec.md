# plugin-ipc-handshake-write-deadline-v1 Spec Delta

## ADDED Requirements

### Requirement: handshake write MUST complete within the deadline

`write_mxpc_frame_timed` MUST 在给定 deadline 内写完整帧。对端不读导致发送缓冲满 MUST `handshake-timeout`。boot supervisor 拒绝意外连接 MUST 走 timed write。

#### Scenario: a silent reader cannot complete a handshake write

- **WHEN** 对端不读
- **AND** 发送缓冲被大帧填满
- **THEN** `write_mxpc_frame_timed` MUST `handshake-timeout`
