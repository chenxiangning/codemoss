# Design: plugin-host-loopback-driver

## Decisions

### D1. 不改 Host 状态机

`Host<D>` 保持 1B API。只新增 `LoopbackDriver`。

### D2. 环回就是 buffer

`start(entry)`：

1. Host 侧 `encode_mxpc(hello)`
2. 假对端 `decode_mxpc` + `validate_handshake_hello`
3. 假对端 `encode_mxpc(ack)`
4. Host 侧 `validate_handshake_ack`
5. 任一步失败返回 `DriverError::Crash`（映射 `handshake-rejected`）

### D3. 仍默认不进 boot

测试里 `HostConfig.enabled=true`。`lib.rs::run` 不构造 Host。
