# Proposal: plugin-host-uds-driver

> OpenSpec change id: `plugin-host-uds-driver`  
> Wave：1E2（插座余量 · UDS 接 Host，无 spawn）  
> 依赖：1E UDS 成帧、1B Host、1C loopback

## Why

1E 证明 MXPC 能过 UDS，Host 仍只用内存 LoopbackDriver。若不先把 handshake 接到 `EntryDriver`，1F QuickJS 会同时引入进程与 transport。1E2 用线程模拟对端，Host 经 UDS 完成 hello/ack。

## 目标与边界

1. `UdsHandshakeDriver` 实现 `EntryDriver`。
2. `start`：注入短路径 UDS 上写 hello、读 ack、校验 nonce。
3. 坏 nonce → `DriverError::Crash`，Host 回滚已 start 的 entry。
4. **不** `Command::spawn`、**不** QuickJS、**不**进 boot。

## 非目标

- Named Pipe / framed stdio
- 产品插件进程
- Notes / Claude 切流

## Capabilities

- `plugin-host-uds-driver-v1`

## 验收标准

1. Notes fixture unit 经 UDS driver → `ready`。
2. 第二 entry 坏 nonce → slot `failed`，第一 entry 被 stop。
3. 源码无 `std::process::Command`。
4. `openspec validate` 通过。
