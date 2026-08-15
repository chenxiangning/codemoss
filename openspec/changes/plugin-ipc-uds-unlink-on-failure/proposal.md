# Proposal: plugin-ipc-uds-unlink-on-failure

> Wave：1UDS11（插座本体 · UDS handshake 失败也必须删除 socket 文件）  
> 依赖：1UDS9 按 plugin 隔离  
> 论文对齐：unload = LIFO inverse；失败的发射必须卸载 socket。

## Why

`UdsHandshakeDriver` 只在 peer 写完 ack 后 `remove_file`。connect / hello / ack 失败时 socket 文件留在 0700 目录里。Worker 已在 join 后删；UDS driver 没有。

## 边界

1. UDS handshake MUST 在成功与失败路径都 unlink socket。
2. Worker handshake 仍 MUST unlink。
3. 错 nonce 之后该 path MUST 不存在。
4. 不切产品。

## Capabilities

- `plugin-ipc-uds-unlink-on-failure-v1`
