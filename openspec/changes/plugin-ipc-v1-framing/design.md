# Design: plugin-ipc-v1-framing

## Context

`14` §13 是字节级事实源。本 change 只把那份 IPC Contract 变成可测编解码，不听端口、不解释业务 method。

## Goals

1. 一份 fixture，两端编解码一致。
2. fail closed：坏帧不产出半条消息。
3. 与生产路径隔离。

## Non-Goals

- 不实现 Host supervisor。
- 不实现 transport（Named Pipe / UDS / stdio）。
- 不实现 Broker method 集合（handshake 除外的 JSON-RPC method 当不透明 payload）。

## Decisions

### D1. 常量单源

```text
MXPC_MAGIC = 0x4D585043
MXPD_MAGIC = 0x4D585044
VERSION    = 1
MAX_PAYLOAD = 1_048_576
WINDOW_FRAMES = 32
WINDOW_BYTES  = 8_388_608
CODECS = engine-event-v1 | blob-v1 | log-v1
```

Rust / TS 从 `packages/plugin-contract/schemas/ipc/constants.v1.json` 读取或复制同一数字；测试用同一 hex fixture。

### D2. API

```text
encodeMxpc(jsonRpcObject) -> Result<Uint8Array, IpcError>
decodeMxpc(bytes) -> Result<{ message, rest }, IpcError>
encodeMxpd({ flags, streamId, seq, payload }) -> Result<Uint8Array, IpcError>
decodeMxpd(bytes) -> Result<{ frame, rest }, IpcError>
validateHandshakeHello(obj) / validateHandshakeAck(obj, nonce)
```

流式：decode 吃 buffer，不足一帧返回 `need-more`，不抛。完整坏帧返回 error 并丢弃该帧头。

### D3. fail-closed 表

| 输入 | code |
|---|---|
| magic ≠ MXPC/MXPD | `bad-magic` |
| version ≠ 1 | `unsupported-version` |
| flags reserved bit 置位（MXPC 必须 0；MXPD bit3–7 必须 0） | `reserved-flag` |
| payload_len > 1 MiB | `payload-too-large` |
| 声明长度超过剩余 bytes | `truncated` |
| MXPC payload 非 UTF-8 JSON object | `invalid-json` |
| 整段是 `...\n{...}\n` 而无 MXPC header | `ndjson-forbidden` |
| codec ∉ allowlist | `unknown-codec` |
| handshake 缺 nonce / 不回显 / protocolVersion≠1 | `handshake-rejected` |

### D4. 不注册 transport

`plugin_runtime/ipc.rs` 只暴露纯函数。Wave 1A 结束时 `command_registry.rs` 与 AppShell 不变。

## Risks

| 风险 | 缓解 |
|---|---|
| 与 `14` 字节序漂 | fixture 用手工 hex，锁 magic 大端 + length 小端 |
| 过早上 socket | 目录不出现 `listen` / `UnixListener` |
| 把 JSON-RPC method 当本 change 范围 | 除 handshake 外 payload 当不透明 object |
