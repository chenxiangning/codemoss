# Proposal: plugin-runtime-process-allowlist

> Wave：1F4（插座本体 · Restricted Process executable allowlist）  
> 依赖：1F3 Manifest kind=process  
> 论文对齐：未声明依赖直接拒绝；shell / 解释器不是允许的获取。

## Why

合同 `mossx.process.spawn` 要求 executable allowlist。`RestrictedProcessDriver` 只要路径是文件就能 spawn。`/bin/sh`、`cmd.exe` 会把 Restricted Process 变成任意命令面。

## 边界

1. `process_executable_ok` MUST 拒绝相对路径、`..`、空路径。
2. 已知 shell / 解释器 MUST 拒绝：`sh` `bash` `zsh` `cmd.exe` `powershell` `pwsh` `python` `node`。
3. 未过闸门的 executable MUST 不得留下 child。
4. idle fixture（`/bin/sleep` / `timeout.exe`）MUST 仍可通过。
5. 不切产品，不进 Marketplace。

## Capabilities

- `plugin-runtime-process-allowlist-v1`
