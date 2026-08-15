# Design

新增 `accept_uds_timed(listener, timeout)`：`poll` listener 可读后再 `accept`。超时映射 `handshake-timeout`。driver / Worker 握手改走 timed accept。
