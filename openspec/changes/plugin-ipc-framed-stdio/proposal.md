# Proposal: plugin-ipc-framed-stdio

> OpenSpec change id: `plugin-ipc-framed-stdio`  
> Wave：1E3（插座余量 · framed stdio，无 spawn）  
> 依赖：1A MXPC codec、1E UDS 成帧  
> 架构：[`10`](../../../docs/architecture/plugin-platform/10-ipc-transport-and-wire-protocol.md) Host↔Restricted Process = length-prefixed framed stdio

## Why

UDS 已证明 MXPC 能过 socket。合同里 Process Entry 走的是 framed stdio，不是 UDS。若不先在 **进程内 pipe** 上证明同一套 `read_mxpc_frame` / `write_mxpc_frame`，1F spawn 会把 pipe 成帧和进程生命周期缠死。

## 目标与边界

1. 用 `std::io::pipe` 模拟 stdin/stdout，不 `Command::spawn`。
2. 复用 1E 的 MXPC 读写，禁止另写一套 NDJSON。
3. hello/ack 往返；坏 nonce fail closed。
4. 不接 Host driver、不进 boot、不迁 Notes、不 disable Claude。

## 非目标

- 真子进程 / QuickJS（1F）
- Windows Named Pipe
- Host 挂进启动链

## Capabilities

- `plugin-ipc-framed-stdio-v1`

## 验收标准

1. pipe 上 hello/ack 经现有 MXPC codec 成功。
2. 坏 nonce 被 `validate_handshake_ack` 拒绝。
3. 源码无 `std::process::Command`。
4. `openspec validate` 通过。
