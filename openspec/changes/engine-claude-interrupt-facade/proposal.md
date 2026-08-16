# Proposal: engine-claude-interrupt-facade

> OpenSpec change id: `engine-claude-interrupt-facade`  
> Wave：3I（第一根插头 · 产品 interrupt 走门面）  
> 依赖：`engine-claude-compat-lifecycle`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3H 给 `EngineManager` 补了 `interrupt_claude_sessions`。产品 `engine_interrupt` 和 daemon 仍直打 `claude_manager`。flag on 时 load 走门面、unload 绕过，双路径无法单独回滚。

## 目标与边界

1. GUI `engine_interrupt` 的 Claude 分支 MUST 调 `EngineManager::interrupt_claude_sessions`。
2. daemon `engine_interrupt` 的 Claude 分支 MUST 同样走该入口。
3. MUST NOT 改 `engine_interrupt_turn`（下一刀）。
4. MUST NOT 默认开 flag、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace。

## Capabilities

- `engine-claude-interrupt-facade-v1`
