# Design

`issue_handshake_nonce()` 用两个 UUID v4 拼 32 字节 hex。`spawn` / `uds_driver` / `named_pipe_driver` / `loopback` 每次 handshake 签发一次，hello 与 ack 都用它。测试断言两次签发不相等，且不再出现生产常量 `HANDSHAKE_NONCE = "aaa..."`.
