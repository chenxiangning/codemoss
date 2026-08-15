# Design

扩展 `RestrictedProcessDriver` 的 handshake 模式：

- `start`：`Stdio::piped()` + `MOSSX_HANDSHAKE_NONCE`
- 复用 `uds::{read,write}_mxpc_frame` 与 `validate_handshake_ack`
- 失败：`kill` + `wait`，不插入 live map
- 测试 peer：独立 `rustc` 小程序，读 hello、回 ack、等待被 kill

1F1 的 `/bin/sleep` 路径保持默认关闭 handshake。
