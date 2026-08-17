# Proposal: engine-claude-process-entry-stream-loop

> OpenSpec change id: `engine-claude-process-entry-stream-loop`  
> Wave：P4.7 批次 8（第一根插头 · 产品行读循环合同）  
> 依赖：`engine-claude-process-entry-stream-lines`  
> 架构：生产 `ClaudeSession::send_message` 的 `BufReader::lines()` + first-event timeout + 并行 stderr

## Why

批次 7 已有 `next_line` 和 `read-stderr`。生产 `send_message` 不是单次 `next_line`——它循环读行，首事件超时则失败，同时采 stderr。把产品路径直接换成一次 `next_line` 仍是假插头。

本刀把这条读循环收成 `run_supervised_stream_loop`：在 cursor 上读行，并行抽 stderr，首行超时 fail closed。默认 `send_message` 仍 `cmd.spawn()`。flag-on 仍 fail closed。不搬 post-result grace / text-delta coalesce。

## 目标与边界

1. `run_supervised_stream_loop` MUST 逐行回调；首行在 deadline 内未到 MUST 返回 `first-event-timeout`。
2. 循环期间 MUST 可读 stderr，结果随返回值带出。
3. **MUST NOT** 改 `send_message` 走该函数，**MUST NOT** 默认开 flag，**MUST NOT** Slim，**MUST NOT** 宣称 stream conformance。

## Capabilities

- `engine-claude-process-entry-stream-loop-v1`
