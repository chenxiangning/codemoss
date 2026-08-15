# Design

复用 UDS 的 FNV-1a token。`private_pipe_name` 产出 `\\.\pipe\mossx-{token}`。driver `start` 在 gate 后解析该名；Windows handshake bind 它。测试覆盖非法 id、Notes/Claude、同后缀碰撞。
