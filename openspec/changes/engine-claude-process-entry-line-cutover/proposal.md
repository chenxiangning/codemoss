# Proposal: engine-claude-process-entry-line-cutover

> OpenSpec change id: `engine-claude-process-entry-line-cutover`  
> Wave：P4.7 批次 11（第一根插头 · 产品行读接到 cursor）  
> 依赖：`engine-claude-process-entry-turn-handle`  
> 架构：[`15` §3 Dual-run](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

批次 10 已能 flag-on 真 spawn Process Entry，但行源未切，立刻杀组。产品 `send_message` 仍有 5 处 stdout `lines.next_line()` 加 1 处 stderr。不把这些读接到 cursor，插头就停在「拉起来就杀掉」。

本刀把行源切成 `ProcessEntry`：flag-on 用 `SupervisedStdoutCursor::poll_line`，默认仍 Tokio `BufReader`。同一时刻只有一个 owner。interrupt / drop 必须能杀掉 Process Entry generation。不搬 post-result grace 语义到新循环——产品循环保留，只换行源。不宣称 stream / exit-status conformance。

## 目标与边界

1. `decide_claude_line_source(true)` MUST 为 `ProcessEntry`，MUST NOT 再 `ProcessEntryNotCutover`。
2. flag-on `send_message` MUST 经 cursor 读行，MUST NOT 在 spawn 后立刻 `process-entry-lines-not-cutover`。
3. 默认路径 MUST 仍 `cmd.spawn()` + `lines.next_line()`。
4. **MUST NOT** 默认开 flag，**MUST NOT** Slim，**MUST NOT** 改 `boot_driver()`。

## Capabilities

- `engine-claude-process-entry-line-cutover-v1`
