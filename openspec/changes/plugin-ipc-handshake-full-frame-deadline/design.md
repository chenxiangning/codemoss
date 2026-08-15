# Design

`read_mxpc_frame_timed` 用 `Instant` deadline。header 与 payload 各自 `poll` + 非阻塞 `read`，剩余时间为 0 则 `handshake-timeout`。不再在第一次可读后无期限 `read_exact`。
