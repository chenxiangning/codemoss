# Proposal: plugin-ipc-worker-uds

> Wave：1QJ7（插座本体 · Worker handshake 必须走私有 UDS）  
> 依赖：1QJ6 Worker handshake、1UDS4 peer uid、1HS4 2s 截止  
> 论文对齐：handshake 是发射；Worker 与 Process 必须走真实 transport，不得只在 Host 进程内自问自答。

## Why

1QJ6 让 Worker 先握手再 live，但仍是 `encode_mxpc` / `decode_mxpc` 内存往返。Process / UDS driver 已经走真实 socket。Worker 这条纤程还没有独立上下文。

## 边界

1. Unix Worker handshake MUST bind `private_uds_path`，MUST `accept_uds` / `connect_uds`。
2. hello / ack MUST 仍绑定 nonce + generation + pluginId，读 ack MUST 受 2s 截止。
3. handshake 失败 MUST 不得留下 isolate，且 MUST 删除 socket 文件。
4. 非 Unix 仍走内存 MXPC（Named Pipe Worker 是后续刀）。
5. 不嵌 C 引擎。boot 仍默认 off。不切产品。

## Capabilities

- `plugin-ipc-worker-uds-v1`
