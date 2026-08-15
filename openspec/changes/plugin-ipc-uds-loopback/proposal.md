# Proposal: plugin-ipc-uds-loopback

> OpenSpec change id: `plugin-ipc-uds-loopback`  
> Wave：1E（插座余量 · 真实 UDS，无 spawn）  
> 依赖：1A MXPC codec、1C 内存 loopback  
> 架构：[`14` §13.5](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)、[`10`](../../../docs/architecture/plugin-platform/10-ipc-transport-and-wire-protocol.md)

## Why

1A–1D 只在内存里编解码。若不先证明 **MXPC 能在 Unix Domain Socket 上成帧读写**，下一步 QuickJS/Process 会把 transport 和 runtime 缠死。1E 只做注入 socket 路径上的同步读写，不进 boot、不 spawn、不听固定产品路径。

## 目标与边界

1. `UnixSocketTransport` 绑定调用方注入的 socket 路径（测试用 temp）。
2. 客户端连上后写入 MXPC hello，服务端读完整帧并回 MXPC ack。
3. 禁止 local TCP。
4. 禁止硬编码 `/tmp/mossx.sock` 或用户 app-data socket。
5. **不**实现 Named Pipe（Windows 另刀）、**不** framed stdio、**不** QuickJS、**不** Host boot。

## 非目标

- Host `EntryDriver` 改走 UDS（可测完再议 1E2）
- Data Plane MXPD 真流
- 进程 spawn / env nonce 交付

## Capabilities

### New Capabilities

- `plugin-ipc-uds-loopback-v1`：注入路径 UDS 上的 MXPC 读写

## 验收标准

1. temp socket 上 hello/ack 经 `encode_mxpc` / `decode_mxpc` 往返成功。
2. nonce 不匹配的 ack 被 `validate_handshake_ack` 拒绝。
3. 源码不出现 `TcpListener` / `127.0.0.1`。
4. `openspec validate` 通过。
5. `note_cards` / `engine/claude*` 无 diff。
