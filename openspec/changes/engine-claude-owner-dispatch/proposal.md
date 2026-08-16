# Proposal: engine-claude-owner-dispatch

> OpenSpec change id: `engine-claude-owner-dispatch`  
> Wave：3Q（第一根插头 · flag-on / flag-off 单一分发）  
> 依赖：`engine-claude-core-accessor`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3P 把字段读取收成 `core_claude()`。`EngineManager` 每个 Claude 入口仍手写 `if let Some(facade)`。remove 循环在门面和 flag-off 各写一份。漏一条就会绕过门面。

## 目标与边界

1. `EngineManager` MUST 经私有 `claude_owner()` 分发。
2. flag on MUST 走门面；flag off MUST 走 `core_claude()`。
3. remove workspace sessions MUST 只在 Core manager 写一份。
4. MUST NOT 默认开 flag、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace。

## Capabilities

- `engine-claude-owner-dispatch-v1`
