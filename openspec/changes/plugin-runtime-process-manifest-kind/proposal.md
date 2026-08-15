# Proposal: plugin-runtime-process-manifest-kind

> Wave：1F3（插座本体 · Restricted Process 只认 Manifest `kind=process`）  
> 依赖：1F1 spawn、1F2 handshake、1QJ4 Manifest kind  
> 论文对齐：隔离粒度必须等于组件声明；UI / Worker 不是 OS 进程。

## Why

`RestrictedProcessDriver::start` 给每个 required entry 开 child。Notes 的 `notes-ui` / `notes-worker` 因此拿到 OS 进程。合同规定只有 `kind=process` 才进 Restricted Process。

## 边界

1. child MUST 只给 fixture / catalog 中 `kind=process` 的 entry。
2. Notes 激活 MUST 不留 child。
3. Claude 激活 MUST 只留 `claude-cli`。
4. 仅名字像 process 的 entry MUST NOT spawn。
5. 不切产品，不进 boot。

## Capabilities

- `plugin-runtime-process-manifest-kind-v1`
