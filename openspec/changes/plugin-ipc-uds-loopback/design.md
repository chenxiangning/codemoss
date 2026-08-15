# Design: plugin-ipc-uds-loopback

## Decisions

### D1. 同步 std::os::unix::net

单测用线程：listener accept + 对端 connect。不引入 tokio 进 `plugin_runtime` 热路径，避免和 Host 同步 FSM 搅在一起。

### D2. 路径注入

`bind(path: &Path)`。测试用 `unique_temp_root` 下的 `mxpc.sock`。测完 unlink。

### D3. 只读完整一帧

`read_mxpc_frame` 先读 10 字节头，再按 `payload_len` 读 body。截断 → `truncated`。

### D4. 本刀不做 Host driver

证明 bytes 能过 socket 即可。把 UdsDriver 接进 Host 是下一刀，避免 1E 同时验 transport 与激活回滚。
