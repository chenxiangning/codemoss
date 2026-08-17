# Proposal: engine-claude-process-entry-turn-handle

> OpenSpec change id: `engine-claude-process-entry-turn-handle`  
> Wave：P4.7 批次 10（第一根插头 · 产品 turn 句柄）  
> 依赖：`engine-claude-process-entry-line-source`  
> 架构：[`15` §3 Dual-run](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md) · [`claude-process-migration-gap.md`](../../../docs/architecture/plugin-platform/inventory/claude-process-migration-gap.md)

## Why

批次 9 抽出了行源开关，但 flag-on 仍 fail closed。产品 `send_message` 握着 tokio `Child` 的 35 处 stdin/stdout/stderr/interrupt。没有可替换句柄，就无法真切 spawn。

本刀抽出 `ClaudeTurnHandle`：`CoreChild`（默认）或 `ProcessEntry`（flag-on + 合法 SpawnPlan + 可解析 Process Entry）。flag-on 时 MUST 经 Host activate + supervise 拉起 CLI，MUST NOT `cmd.spawn()`。读循环仍走 Core `BufReader` 之前必须先有这个句柄；本刀 **MUST NOT** 替换 6 处 `next_line`。默认路径 MUST 仍 `cmd.spawn()`。

## 目标与边界

1. `spawn_claude_turn`：flag off → Core `Command::spawn`；flag on + 合法 plan + Process Entry → Host activate/supervise。
2. 句柄必须能 `write_stdin` / `close_stdin` / `interrupt`（Process Entry 走 MXPC + Host interrupt）。
3. **MUST NOT** 默认开 flag，**MUST NOT** 改 `boot_driver()`，**MUST NOT** Slim，**MUST NOT** 宣称 stream conformance。
4. `send_message` 本刀只在 spawn 点接线；行读仍 Tokio。flag-on 且句柄为 Process Entry 时，行读 MUST 仍 fail closed（禁止 Core 读一个它没 spawn 的 Child）。

## Capabilities

- `engine-claude-process-entry-turn-handle-v1`
