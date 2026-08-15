# Proposal: plugin-storage-blank-identity

> Wave：1AV（Storage · 空白 pluginId 不得摸 store）  
> 依赖：1AS 未知 / 空白 lifecycle、1AO 空身份

## Why

activate / fuse / disable / reset 已对空白 pluginId 返回 `schema`。组合面 store API 仍走 `ensure_ready`，空白 id 只得到 `plugin-unavailable`。1F 后不得用空白身份开 namespace。

## 边界

1. 空白 `pluginId` 的 `open_own_store` / `checkpoint_own_store` / `access_store` MUST `schema`。
2. 不进 boot，不迁 `note_cards`。

## Capabilities

- `plugin-storage-blank-identity-v1`
