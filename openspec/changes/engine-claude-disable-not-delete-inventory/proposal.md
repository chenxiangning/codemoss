# Proposal: engine-claude-disable-not-delete-inventory

> OpenSpec change id: `engine-claude-disable-not-delete-inventory`  
> Wave：3AM（第一根插头 · disable-not-delete 证据只盘点）  
> 依赖：`engine-claude-plugin-package-manifest-align`  
> 架构：[`15` §3 step 7](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

3AL 把过渡仓 Manifest 与 3B fixture 对齐。插头协议第 7 步是 disable-not-delete：Core 实现 disabled，源码先留着。现在 Host fixture 已能 disable，但产品 Claude 仍是唯一 runtime owner。不先钉这条边界，下一步会误把产品 Claude 关掉或删掉。

## 目标与边界

1. 落下 `docs/architecture/plugin-platform/inventory/claude-disable-not-delete.json`。
2. 标明：Host fixture disable 已有证据；产品路径仍用 Core Claude；`engine/claude.rs` 必须留下。
3. **不修改**任何生产 disable / 启动链。
4. MUST NOT 删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-disable-not-delete-inventory-v1`
