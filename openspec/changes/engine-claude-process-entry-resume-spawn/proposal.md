# Proposal: engine-claude-process-entry-resume-spawn

> OpenSpec change id: `engine-claude-process-entry-resume-spawn`  
> Wave：P4.7 批次 13（第一根插头 · resume 再走 Process Entry）  
> 依赖：`engine-claude-process-entry-resume-gate`  
> 架构：[`15` §3 Dual-run](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

批次 12 堵住了第二条 Core Child，但 flag-on 中途 approval / AskUser 仍直接失败。真插头必须把 resume 再走 `spawn_process_entry_turn`：杀掉旧 generation，拉起新 CLI，行读继续走 cursor。默认路径 MUST 仍 `cmd.spawn()`。

## 目标与边界

1. flag-on resume MUST 经 Process Entry 再 spawn，MUST NOT `cmd.spawn()`。
2. 旧 generation MUST 先 interrupt。新句柄 MUST 写入 `active_process_entries`。调用方 MUST `Ok(None)` 让现有循环继续 `next_claude_line`。
3. **MUST NOT** 默认开 flag，**MUST NOT** Slim，**MUST NOT** 宣称 resume conformance。

## Capabilities

- `engine-claude-process-entry-resume-spawn-v1`
