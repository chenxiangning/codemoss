# Proposal: engine-claude-process-entry-stdio

> OpenSpec change id: `engine-claude-process-entry-stdio`  
> Wave：P4.7 批次 5（第一根插头 · CLI stdio 中继）  
> 依赖：`engine-claude-process-entry-spawn-plan`  
> 架构：[`14` §13.3 / §13.4](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

批次 4 已抽出生产 SpawnPlan（bin + argv + cwd），但 Process Entry 把 CLI stdin/stdout 丢进 `Stdio::null()`。Host 看不见流，产品 `send_message` 就不能迁。本刀补上封闭 MXPC 中继：`write` / `read` / `close-stdin`。

这不是 MXPD，也不是产品 stream cutover。`MOSSX_CLAUDE_PROCESS_ENTRY` 打开时仍 fail closed，禁止 Core 与 Process Entry 各拉一个 CLI。

## 目标与边界

1. supervise 后 CLI stdin/stdout 必须 pipe，不得 null。
2. Host 只能经 `mossx.process.stdio.write` / `read` / `close-stdin` 碰这些管道。payload 用 `dataHex`。
3. 未知 method、无被监督子进程、非法 hex MUST fail closed。
4. **MUST NOT** 改 `boot_driver()`，**MUST NOT** 默认开 flag，**MUST NOT** 让 `send_message` 走中继，**MUST NOT** Slim，**MUST NOT** 宣称 stream conformance。

## Capabilities

- `engine-claude-process-entry-stdio-v1`
