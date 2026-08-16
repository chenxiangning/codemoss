# Proposal: engine-claude-plugin-package-manifest-align

> OpenSpec change id: `engine-claude-plugin-package-manifest-align`  
> Wave：3AL（第一根插头 · 过渡仓 Manifest 与 3B fixture 对齐）  
> 依赖：`engine-claude-plugin-package-skeleton`  
> 架构：[`11`](../../../docs/architecture/plugin-platform/11-manifest-and-runtime-registration.md)

## Why

3AK 落下 `packages/plugin-engine-claude/.mossx-plugin/plugin.json`。身份字段必须与 3B fixture `claude-engine.json` 对齐，否则 Host 假激活与过渡仓会各说各话。description 可以不同：fixture 描述 compatibility adapter，过渡仓标明 default-off。

## 目标与边界

1. 过渡仓 Manifest 的 `pluginId` / `version` / `entries` / `activationUnits` / `contributions` / `capabilities` / `compatibility` / `budgets` MUST 与 3B fixture 相同。
2. description MAY 不同。
3. 本刀 MUST NOT 把该包挂进 Host / boot / Marketplace。
4. MUST NOT 删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-plugin-package-manifest-align-v1`
