# Proposal: plugin-ipc-uds-accept-deadline

> Wave：1UDS7（插座本体 · UDS accept 必须在 handshake deadline 内完成）  
> 依赖：1HS8 接受端读 hello 截止  
> 论文对齐：handshake 是发射；无人连接不得一直占着 listener。

## Why

1HS8 罩住了 accept 之后的读帧。`accept_uds` 本身仍无限 `listener.accept()`。没有对端 connect 时，peer 线程会一直挂着。

## 边界

1. `accept_uds_timed` MUST 用同一 handshake deadline `poll` listener。
2. 无人连接 MUST `handshake-timeout`。
3. UDS driver / Worker handshake MUST 走 timed accept。
4. 不切产品。

## Capabilities

- `plugin-ipc-uds-accept-deadline-v1`
