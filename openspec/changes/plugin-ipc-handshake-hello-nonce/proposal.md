# Proposal: plugin-ipc-handshake-hello-nonce

> Wave：1HS7（插座本体 · handshake hello 必须绑定本次签发的 nonce）  
> 依赖：1HS1 独立签发、1HS3 hello generation  
> 论文对齐：handshake 是发射；外来 nonce 不是本次激活的获取。

## Why

`validate_handshake_hello` 现在只核 nonce 是 64 hex。UDS / Named Pipe / Worker 接受端只要形状对就会回 ack。外来 hello 可以抢先占用 accept，并读到签发 nonce。

## 边界

1. `validate_handshake_hello(value, expected_generation, expected_nonce)` MUST 要求 hello nonce 等于本次签发值。
2. 外来 / 缺失 / 形状错误 nonce MUST `handshake-rejected`。
3. spawn / UDS / Named Pipe / Loopback / Worker 接受端 MUST 传入本次签发 nonce。
4. 不切产品。

## Capabilities

- `plugin-ipc-handshake-hello-nonce-v1`
