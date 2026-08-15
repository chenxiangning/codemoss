# Proposal: plugin-host-named-pipe-driver

> Wave：1NP3（插座本体 · Named Pipe Host driver）  
> 依赖：1NP1 名字闸门、1NP2 ACL、1E2 UDS driver  
> 论文对齐：transport 是获取；非目标平台不得假装成功。

## Why

UDS Host driver 已落地。Windows 合同对等物是 Named Pipe。本刀加 `NamedPipeHandshakeDriver`：非 Windows `activate` 必须失败且不留 slot；pipe 名必须过 `pipe_name_ok` + `pipe_acl_ok`。Windows hello/ack 复用 1NP1 的 `cfg(windows)` 路径。

## 边界

1. 非 Windows start MUST `Crash`，Host slot MUST `Failed`。
2. 非法 pipe 名 / 空 ACL MUST 在 start 前失败。
3. 不进产品 boot 替换（boot 仍用 UDS driver）。
4. 不切 Claude / Notes。

## Capabilities

- `plugin-host-named-pipe-driver-v1`
