# Design

Unix `connect_uds_timed`：先 `parent_is_owner_only`，再非阻塞 `UnixStream::connect`。`EINPROGRESS` 则 `poll(POLLOUT)` 直到 deadline。超时 `handshake-timeout`。测试：bind 但不 accept，30ms connect 超时。driver / Worker 改 timed connect。
