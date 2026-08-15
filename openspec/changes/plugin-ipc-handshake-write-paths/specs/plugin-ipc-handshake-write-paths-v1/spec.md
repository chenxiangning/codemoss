# plugin-ipc-handshake-write-paths-v1 Spec Delta

## ADDED Requirements

### Requirement: production handshake writes MUST use the timed writer

Unix UDS driver、QuickJS Worker、Restricted Process handshake MUST 用 `write_mxpc_frame_timed` 发送 hello / ack。这些模块的 handshake 路径 MUST NOT 再调用阻塞 `write_mxpc_frame`。

#### Scenario: handshake modules do not block on write

- **WHEN** 检查 `uds_driver.rs` / `quickjs.rs` / `spawn.rs`
- **THEN** 它们 MUST 调用 `write_mxpc_frame_timed`
- **AND** MUST NOT 在 handshake 路径调用 `write_mxpc_frame(`
