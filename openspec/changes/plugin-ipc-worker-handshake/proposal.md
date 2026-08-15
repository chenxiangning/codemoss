# Proposal: plugin-ipc-worker-handshake

> Wave：1QJ6（插座本体 · Worker isolate 必须先完成 handshake 才能 live）  
> 依赖：1QJ4 Manifest kind/runtime、1HS2 ack 身份绑定  
> 论文对齐：handshake 是发射；失败必须卸载，不得留下 live isolate。

## Why

Process / UDS / Loopback 都在 `start` 里握手。QuickJS Worker 只按 Manifest 建 isolate，不签发 nonce，也不核验 ack。失败的发射仍会留下 live 纤程。本刀不嵌 C 引擎。

## 边界

1. Worker `start` MUST 先完成 in-memory MXPC hello/ack，再插入 isolate。
2. ack MUST 绑定当次 nonce、当前 `pluginId`、当前 `generation`。
3. handshake 失败 MUST 不得留下 isolate，且 Host 必须回滚更早 entry。
4. 未声明 worker 仍不得建 isolate。
5. 不嵌 rquickjs / C 引擎。不切产品。

## Capabilities

- `plugin-ipc-worker-handshake-v1`
