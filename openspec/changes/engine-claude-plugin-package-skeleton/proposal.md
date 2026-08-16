# Proposal: engine-claude-plugin-package-skeleton

> OpenSpec change id: `engine-claude-plugin-package-skeleton`  
> Wave：3AK（第一根插头 · Claude plugin 过渡仓骨架）  
> 依赖：`engine-claude-history-remaining-call-sites`  
> 架构：[`07`](../../../docs/architecture/plugin-platform/07-repository-distribution-marketplace.md) · [`15` §3 step 4](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

3AJ 确认产品 history 操作已走默认 off 门面。插头协议下一步是 Pilot repo：独立仓库或 `packages/` 过渡仓。现在还没有这份骨架，dual-run 仍只有 Core 门面，没有可核对的 plugin 包位置。

## 目标与边界

1. 落下 `packages/plugin-engine-claude/.mossx-plugin/plugin.json`，`pluginId` MUST 为 `com.mossx.engine.claude`。
2. 本刀 MUST NOT 把该包挂进 Host / boot / Marketplace。
3. MUST NOT 放入可执行 bin、签名 sidecar、SBOM。
4. MUST NOT 删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-plugin-package-skeleton-v1`
