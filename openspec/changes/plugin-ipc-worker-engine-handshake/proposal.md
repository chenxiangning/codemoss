# Proposal: plugin-ipc-worker-engine-handshake

> Wave：1QJ10（插座本体 · Worker handshake 必须在 live 引擎线程完成）  
> 依赖：1QJ5 真实 Runtime、1QJ6 handshake-before-live、1QJ7 私有 UDS  
> 论文对齐：handshake 是发射；发射必须发生在已获取的独立上下文里。失败必须卸下该上下文。

## Why

1QJ6 / 1QJ7 的 hello/ack 由假 peer 线程完成，然后再 `spawn_engine`。Runtime 从未参与握手。失败的发射与成功的引擎不是同一条纤维。

## 边界

1. `start` MUST 先创建 QuickJS Runtime 线程，再握手。
2. Unix 上引擎线程 MUST 自己 connect / 写 hello / 读 ack。
3. 引擎线程 MUST 先 `eval("mossx.handshake.hello()")` 再发 hello。
4. 错 nonce / 超时 MUST drop Runtime，不得留下 isolate。
5. 不切产品。

## Capabilities

- `plugin-ipc-worker-engine-handshake-v1`
