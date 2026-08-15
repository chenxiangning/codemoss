# Proposal: plugin-storage-canonical-identity

> Wave：1BG（Storage · 底层 open_or_create 拒绝未 trim pluginId）  
> 依赖：1BE 组合面 canonical 身份

## Why

组合面已拒 `" com.mossx.notes "`。`StorageService::open_or_create` 仍只拒 `is_empty()`，空白 / 带空格 id 会开出独立 namespace。1F 后不得绕过 Host 直接开脏路径。

## 边界

1. `open_or_create` 对空、仅空白、前后空白 pluginId MUST `schema`。
2. 不得写入 namespace。
3. 不进 boot，不迁 `note_cards`。

## Capabilities

- `plugin-storage-canonical-identity-v1`
