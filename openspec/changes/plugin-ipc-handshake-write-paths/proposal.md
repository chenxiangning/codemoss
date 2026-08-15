# Proposal: plugin-ipc-handshake-write-paths

> Wave：1HS11（插座本体 · UDS / Worker / spawn handshake 写必须走 timed write）  
> 依赖：1HS10 `write_mxpc_frame_timed`  
> 论文对齐：handshake 是发射；任何生产写路径卡住都等于发射未完成。

## Why

1HS10 只改了 boot reject。`UdsHandshakeDriver` / QuickJS Worker / Restricted Process 仍用阻塞 `write_mxpc_frame` 发 hello / ack。对端不读会卡住激活。

## 边界

1. Unix UDS / Worker / spawn handshake 写 MUST 用 `write_mxpc_frame_timed(..., HANDSHAKE_DEADLINE)`。
2. 这些模块的 handshake 路径 MUST NOT 再调用阻塞 `write_mxpc_frame`。
3. 不切产品。

## Capabilities

- `plugin-ipc-handshake-write-paths-v1`
