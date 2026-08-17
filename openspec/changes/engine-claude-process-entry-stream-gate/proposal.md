# Proposal: engine-claude-process-entry-stream-gate

> OpenSpec change id: `engine-claude-process-entry-stream-gate`  
> Wave：P4.7 批次 16（第一根插头 · first-event / interrupt 闸门）  
> 依赖：`engine-claude-process-entry-artifact`  
> 架构：产品 `send_message` 在首事件前有 deadline；超时必须杀进程组。

## Why

批次 15 已能激活制品。产品循环用 `timeout` 包 `next_claude_line`，超时走 `fail_stream_no_event_timeout`。这条合同只在 Core Tokio 路径有真实验收；Process Entry 只有隔离的 `run_supervised_stream_loop` 测试，且不进 `send_message`。

本刀用**制品根**验收产品形合同：有行必须先于 EOF 读到；沉默 CLI 必须在 deadline 后 interrupt 杀组。不跑真实 Claude CLI，不宣称 stream conformance。

## 目标与边界

1. `ProcessEntryTurn` MUST 能在制品根上读到首行，且 MUST 能在沉默时于 deadline 后杀组。
2. 产品 `send_message` MUST 仍自管循环；MUST NOT 调用 `run_supervised_stream_loop`。
3. **MUST NOT** 默认开 flag，**MUST NOT** Slim，**MUST NOT** 宣称 Claude CLI stream conformance。

## Capabilities

- `engine-claude-process-entry-stream-gate-v1`
