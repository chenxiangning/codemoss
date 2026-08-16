# Proposal: engine-claude-core-accessor

> OpenSpec change id: `engine-claude-core-accessor`  
> Wave：3P（第一根插头 · EngineManager 内部只走私有入口）  
> 依赖：`engine-claude-config-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3O 把产品模块挡在字段外。`EngineManager` 内部 flag-off 仍散落 `self.claude_manager`。下一刀若再加入口，容易漏一条绕过路径。

## 目标与边界

1. `EngineManager` MUST 只有 `core_claude()` 读字段。
2. flag-off 分支 MUST 经 `core_claude()`，MUST NOT 再散落 `self.claude_manager.`。
3. MUST NOT 改变 flag 默认 off、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace。

## Capabilities

- `engine-claude-core-accessor-v1`
