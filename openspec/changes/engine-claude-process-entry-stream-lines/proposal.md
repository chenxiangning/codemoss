# Proposal: engine-claude-process-entry-stream-lines

> OpenSpec change id: `engine-claude-process-entry-stream-lines`  
> Wave：P4.7 批次 7（第一根插头 · 增量行读 + stderr）  
> 依赖：`engine-claude-process-entry-turn-io`  
> 架构：[`15` §3 Dual-run](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md) · 生产 `ClaudeSession::send_message` 行读合同

## Why

批次 6 的 `run_supervised_turn_io` 是批式：写完、关掉、读到 EOF。生产 `send_message` 不是这样——它 `BufReader::lines()` 逐行解析 stream-json，同时采 stderr，并允许中途 `interrupt` 杀组。把 `send_message` 直接接到批式 IO 是假插头。

本刀补真缺口：Process Entry 把 stderr 也 pipe 出来；Host 在已有 stdout 中继上做增量行切分。默认路径仍 `cmd.spawn()`。flag-on 仍 fail closed。

## 目标与边界

1. supervise 后 CLI stderr MUST 为 pipe，经 `mossx.process.stdio.read-stderr` 读。
2. Host MUST 能对 stdout 做增量 `next_line`：先到的完整行先返回，不必等 EOF。
3. 中途 `interrupt` MUST 仍杀进程组（沿用批次 2）。
4. **MUST NOT** 改 `send_message` 走该 API，**MUST NOT** 默认开 flag，**MUST NOT** Slim，**MUST NOT** 宣称 stream conformance。

## Capabilities

- `engine-claude-process-entry-stream-lines-v1`
