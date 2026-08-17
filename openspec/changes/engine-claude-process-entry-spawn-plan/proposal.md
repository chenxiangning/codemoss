# Proposal: engine-claude-process-entry-spawn-plan

> OpenSpec change id: `engine-claude-process-entry-spawn-plan`  
> Wave：P4.7 批次 4（第一根插头 · 生产 SpawnPlan 接线）  
> 依赖：`engine-claude-process-entry-map-bin`  
> 架构：[`15` §3 Dual-run](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md) · [`claude-process-migration-gap.md`](../../../docs/architecture/plugin-platform/inventory/claude-process-migration-gap.md)

## Why

批次 3 能把一个绝对路径 `claudeBin` 映射成 `SuperviseTarget`，但生产 `ClaudeSession` 真正 spawn 的是带 `-p` / stream-json / workspace cwd 的完整 `Command`。只映射 bin、不映射 argv/cwd，插头仍是假的。

本刀把生产 `Command` 收成可审计 `SpawnPlan`（executable + argv + cwd），让 Process Entry 的 supervise 吃齐这三项。默认路径仍 `cmd.spawn()`。`MOSSX_CLAUDE_PROCESS_ENTRY` 默认关；打开时 **fail closed**，禁止 Core 与 Process Entry 同时拉起 CLI。stdin/stdout/stream 仍未切，不得宣称产品 conformance。

## 目标与边界

1. 从生产 `Command` 抽出 `SpawnPlan`；相对路径 / 裸 `claude` / shell stem / 缺文件 / 非绝对 cwd → `None`。
2. `SuperviseTarget` 携带 `argv` 与可选 `cwd`；Process Entry 必须按它们 spawn。
3. 默认 owner 仍是 `ClaudeSession::cmd.spawn()`。
4. `MOSSX_CLAUDE_PROCESS_ENTRY=1` 时 MUST NOT `cmd.spawn()`，MUST 返回明确错误，MUST NOT 留下 CLI 子进程。
5. **MUST NOT** 改 `boot_driver()`、**MUST NOT** 默认开任何 flag、**MUST NOT** Slim、**MUST NOT** 宣称 stream / interrupt conformance。

## Capabilities

- `engine-claude-process-entry-spawn-plan-v1`
