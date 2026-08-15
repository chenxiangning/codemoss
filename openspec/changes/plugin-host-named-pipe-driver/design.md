# Design

`NamedPipeHandshakeDriver` 实现 `EntryDriver`。`start` 先 `pipe_name_ok` + `pipe_acl_ok`，再：

- Windows：bind/connect + MXPC hello/ack
- 非 Windows：`DriverError::Crash`

测试在 macOS 覆盖 fail-closed + ACL。Windows 往返留在 `named_pipe.rs` 的 `cfg(windows)` 测试。
