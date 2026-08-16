# Proposal: engine-claude-interrupt-turn-facade

> OpenSpec change id: `engine-claude-interrupt-turn-facade`  
> Wave：3J（第一根插头 · 产品 turn interrupt 走门面）  
> 依赖：`engine-claude-interrupt-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3I 把 workspace interrupt 接到 `interrupt_claude_sessions`。`engine_interrupt_turn` 仍直打 `claude_manager` 找 session。turn 级 unload 绕过门面，双路径无法单独回滚。

## 目标与边界

1. `ClaudeCompatAdapter` MUST 委托 `get_session_for_provider` / `session_for_turn` 到同一份 Core manager。
2. `EngineManager::interrupt_claude_turn` MUST 在 flag on 时经门面 lookup。
3. GUI / daemon `engine_interrupt_turn` 的 Claude 分支 MUST 调该入口。
4. MUST NOT 默认开 flag、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace。

## Capabilities

- `engine-claude-interrupt-turn-facade-v1`
