# Proposal: engine-claude-process-entry-result

> OpenSpec change id: `engine-claude-process-entry-result`  
> Wave：P4.7 批次 18（第一根插头 · 真实 CLI result / 退出码）  
> 依赖：`engine-claude-process-entry-first-interactive`  
> 架构：`15` §3 step 6 Conformance 的 stream 切面（result + exit-status）

## Why

批次 17 只读到 `system/init` 就杀组。产品 `send_message` 要看到 `type=result`，再 `wait` 退出码；非零当失败。本机有 Claude Code 2.1.226，必须经制品根 Process Entry 跑完一条短 print turn：读到 `result`，再收割 code。

缺 CLI / 无法映射时 MUST 跳过，不得假绿。不宣称 storage / rollback conformance，不开 flag，不 Slim。

## 目标与边界

1. 制品根 MUST 能把本机 Claude CLI 读到 `type=result`。
2. 随后 MUST `wait_until` 收到退出码；成功 turn MUST 为 0。
3. **MUST NOT** 默认开 flag，**MUST NOT** Slim，**MUST NOT** 宣称整根插头完成。

## Capabilities

- `engine-claude-process-entry-result-v1`
