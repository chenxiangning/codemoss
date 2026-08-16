# Proposal: engine-claude-history-remaining-call-sites

> OpenSpec change id: `engine-claude-history-remaining-call-sites`  
> Wave：3AJ（第一根插头 · 剩余 `claude_history::*` 直调只盘点）  
> 依赖：`engine-claude-history-native-resolve-facade`  
> 架构：[`15` §3](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

3AI 把 native continuation resolve 接到门面。产品 history 操作面已走默认 off 门面，但类型、常量和 `encode_project_path` 仍直引 `claude_history`。不先钉这些残留，下一步 dual-run 会误把类型引用当漏接。

## 目标与边界

1. 落下 `docs/architecture/plugin-platform/inventory/claude-history-remaining.json`。
2. 标明：产品操作已走门面；残留是类型 / 常量 / session-index helper。
3. **不修改**任何生产实现。
4. MUST NOT 删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-remaining-call-sites-v1`
