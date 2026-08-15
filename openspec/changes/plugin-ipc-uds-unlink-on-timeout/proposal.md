# Proposal: plugin-ipc-uds-unlink-on-timeout

> Wave：1UDS12（插座本体 · UDS handshake 超时 / connect 失败也必须删除 socket）  
> 依赖：1UDS11 错 nonce 后 unlink  
> 论文对齐：unload = LIFO inverse；任何失败的发射都必须卸载 socket。

## Why

1UDS11 只在 `peer.join()` 之后 `remove_file`。`connect_uds` / `write_mxpc_frame` / `read_mxpc_frame_timed` 用 `?` 提前返回时，socket 文件仍留在 0700 目录。沉默对端会触发 2s 超时，这是真实泄漏。

## 边界

1. UDS handshake MUST 用 RAII / 等价 finally 在所有路径 unlink。
2. Worker handshake MUST 同样 unlink。
3. 沉默对端超时后该 path MUST 不存在。
4. 不切产品。

## Capabilities

- `plugin-ipc-uds-unlink-on-timeout-v1`
