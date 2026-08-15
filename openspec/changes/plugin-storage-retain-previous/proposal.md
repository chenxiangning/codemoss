# Proposal: plugin-storage-retain-previous

> Wave：2N（插座通电 · 组合面 retainPrevious 1–5）  
> 依赖：2E checkpoint Ready、2A StorageService retain 闸门

## Why

`checkpoint_own_store` 把 `retainPrevious` 写死为 2。合同允许 1–5。组合面若不能传入非法值并失败，1F 后调用方只能绕过 runtime 直调 DiskStorage。

## 边界

1. `checkpoint_own_store_retained(plugin_id, retain)` 仅 Ready 成功。
2. `retain` 为 0 或 6 MUST `invalid-storage`。
3. `retain` 为 1 MUST 成功。
4. 既有 `checkpoint_own_store` 仍默认 2。
5. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-retain-previous-v1`
