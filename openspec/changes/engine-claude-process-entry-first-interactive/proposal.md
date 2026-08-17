# Proposal: engine-claude-process-entry-first-interactive

> OpenSpec change id: `engine-claude-process-entry-first-interactive`  
> Wave：P4.7 批次 17（第一根插头 · 真实 CLI first-interactive）  
> 依赖：`engine-claude-process-entry-stream-gate`  
> 架构：`15` §3 step 6 Conformance 的 first-interactive 切面

## Why

批次 16 只钉了 `/bin/echo` / `/bin/sleep`。产品 first-interactive 要的是 Claude CLI 的 stream-json 有效事件（`system` / `assistant` / `result` …），不是任意一行。本机有 Claude Code 2.1.226，必须经制品根 Process Entry 读到该事件，再 interrupt 杀组。

缺 CLI / 无法映射绝对路径时 MUST 跳过，不得假绿。不跑完整 turn，不宣称 stream / storage / rollback conformance。

## 目标与边界

1. 制品根 MUST 能 supervise 本机 Claude CLI，并在 deadline 前读到产品形有效事件。
2. 读到后 MUST interrupt，进程组 MUST 不再存活。
3. **MUST NOT** 默认开 flag，**MUST NOT** Slim，**MUST NOT** 宣称整根插头完成。

## Capabilities

- `engine-claude-process-entry-first-interactive-v1`
