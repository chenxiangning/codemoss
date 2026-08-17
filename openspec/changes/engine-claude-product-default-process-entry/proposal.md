# Proposal: engine-claude-product-default-process-entry

> OpenSpec change id: `engine-claude-product-default-process-entry`  
> Wave：P4.7 批次 24（第一根插头 · 产品默认走 Process Entry）  
> 依赖：`engine-claude-dual-run-default-core`  
> 架构：`15` §3 Dual-run / Conformance。产品默认路径必须是真插头。

## Why

Process Entry 已能监督真 CLI。产品 `send_message` 仍默认 `cmd.spawn()`。用户日常路径不是插头。

本刀把未设 `MOSSX_CLAUDE_PROCESS_ENTRY` 视为 **on**。显式 `0/false` 才回退 Core。缺 plan 仍 Denied（fail closed）。不 Slim，不改 `boot_driver()`。

## 目标与边界

1. `claude_process_entry_enabled_from(None)` MUST 为 true。
2. 显式关闭 MUST 仍走 `cmd.spawn()`。
3. 无合法 plan MUST Denied，不得 silently 回 Core。
4. **MUST NOT** Slim，**MUST NOT** 改 boot 默认 executable。

## Capabilities

- `engine-claude-product-default-process-entry-v1`
