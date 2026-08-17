# Proposal: engine-claude-process-entry-line-source

> OpenSpec change id: `engine-claude-process-entry-line-source`  
> Wave：P4.7 批次 9（第一根插头 · 产品行源 dual-run 开关）  
> 依赖：`engine-claude-process-entry-stream-loop`  
> 架构：[`15` §3 Dual-run](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

批次 8 已有 `run_supervised_stream_loop`。生产 `send_message` 有 6 处 `lines.next_line()`，还绑着 first-event timeout、post-result grace、text-delta coalesce。把整段循环换成插件 loop 会丢掉这些语义，也还没有产品 `Child` 以外的第二个 owner。

本刀只抽出行源合同：`ClaudeLineSource` 默认 `Tokio`，`ProcessEntry` 变体存在但 **MUST NOT** 被 `send_message` 选中。`MOSSX_CLAUDE_PROCESS_ENTRY` 打开时仍 fail closed，禁止双 owner。不改 spawn、不改 6 处读循环。

## 目标与边界

1. `decide_claude_line_source(flag)`：flag off → `Tokio`；flag on → `ProcessEntryNotCutover`。
2. `send_message` MUST 继续用 `BufReader::lines()`。
3. **MUST NOT** 默认开 flag，**MUST NOT** Slim，**MUST NOT** 宣称 stream conformance。

## Capabilities

- `engine-claude-process-entry-line-source-v1`
