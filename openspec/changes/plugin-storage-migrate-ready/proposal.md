# Proposal: plugin-storage-migrate-ready

> Wave：2G（插座通电 · migrate 要求 Ready）  
> 依赖：2F restore Ready、2A migration 闸门

## Why

checkpoint / restore 已要求 Ready。migrate 仍可经 `storage.migrate` 直调。合同要求 schema 变更只能由 ready 插件发起。

## 边界

1. `migrate_own_store` 仅 Ready 成功。
2. disable 后 MUST `plugin-unavailable`。
3. 仍走既有 destructive / checkpoint 闸门。
4. 不迁 `note_cards`。

## Capabilities

- `plugin-storage-migrate-ready-v1`
