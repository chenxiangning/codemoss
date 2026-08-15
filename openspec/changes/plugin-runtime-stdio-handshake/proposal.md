# Proposal: plugin-runtime-stdio-handshake

> Wave：1F2（插座本体 · Restricted Process framed stdio handshake）  
> 依赖：1F1 可逆 spawn、1E3 framed stdio  
> 论文对齐：handshake 是排放；失败必须走卸载，已获取的 child 必须 kill。

## Why

1F1 只证明进程生命周期可逆。合同要求 Host↔Process Control 走 length-prefixed framed stdio，并用 `MOSSX_HANDSHAKE_NONCE` 交付 nonce。没有 handshake，Restricted Process 还不是插座。

## 边界

1. handshake 模式 MUST 用 piped stdin/stdout 发 `mossx.handshake.hello`，读 ack。
2. nonce 经 env `MOSSX_HANDSHAKE_NONCE` 交付，不得写盘。
3. 坏 nonce / 读失败 MUST kill 该 child，且不得留在 live map。
4. 第二个 entry handshake 失败时，Host 反向 stop 已握手 child。
5. **禁止**进 `lib.rs::run`，禁止 Named Pipe，禁止 QuickJS，禁止产品切流。

## Capabilities

- `plugin-runtime-stdio-handshake-v1`
