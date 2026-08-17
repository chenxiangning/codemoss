# Proposal: engine-claude-process-entry-turn-io

> OpenSpec change id: `engine-claude-process-entry-turn-io`  
> Wave：P4.7 批次 6（第一根插头 · 产品 turn IO 合同）  
> 依赖：`engine-claude-process-entry-stdio`  
> 架构：[`15` §3 Dual-run](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

批次 5 已证明 Host 能对监督 CLI 做 write / read / close-stdin。生产 `send_message` 的合同是：可选写 stdin、关 stdin、读 stdout 直到 EOF。两边还没对上。

本刀把这条合同收成 `run_supervised_turn_io`，跑在已激活的 Process Entry 上。默认路径仍 `cmd.spawn()`。`MOSSX_CLAUDE_PROCESS_ENTRY=1` 仍 fail closed，禁止双 owner。不替换产品行读 / stderr / interrupt。

## 目标与边界

1. `run_supervised_turn_io(driver, plugin_id, entry_id, generation, stdin)`：有 stdin 则 write + close；无 stdin 则只 close；然后读到 `eof`。
2. 无 child / 中继失败 MUST 返回错误，MUST NOT 留下半开 stdin。
3. **MUST NOT** 改 `boot_driver()`，**MUST NOT** 默认开 flag，**MUST NOT** 让 `send_message` 走该函数，**MUST NOT** Slim，**MUST NOT** 宣称 stream conformance。

## Capabilities

- `engine-claude-process-entry-turn-io-v1`
