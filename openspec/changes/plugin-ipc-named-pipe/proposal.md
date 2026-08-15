# Proposal: plugin-ipc-named-pipe

> Wave：1NP1（插座本体 · Windows Named Pipe MXPC）  
> 依赖：1E UDS MXPC、1F2 framed stdio  
> 论文对齐：transport 是获取；失败不得留 listener / 不得走 TCP。

## Why

合同矩阵：Core↔Host 在 Windows 必须用 Named Pipe，禁止 local TCP。UDS 已落地；Named Pipe 仍缺。本刀只做 transport + hello/ack，不进 boot。

## 边界

1. pipe 名 MUST 为 `\\.\pipe\mossx-*`，否则 `schema`。
2. 非 Windows MUST `unsupported-platform`，不得 bind TCP。
3. Windows MUST 完成 MXPC hello/ack；坏 nonce MUST 拒绝。
4. **禁止**进 `lib.rs::run`，禁止 spawn Host，禁止产品切流。

## Capabilities

- `plugin-ipc-named-pipe-v1`
