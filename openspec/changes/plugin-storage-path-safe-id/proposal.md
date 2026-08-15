# Proposal: plugin-storage-path-safe-id

> Wave：1BI（Storage · 含路径分隔符 / `..` 的 pluginId 不得开 namespace）  
> 依赖：1BG 底层 canonical 身份

## Why

`DiskStorage::data_file` 直接 `join(plugin_id)`。`com.mossx.notes/../escape` 或 `../escape` 会写出 `plugin-runtime/data` 之外。1F 后不得让非法 id 穿越磁盘根。

## 边界

1. `open_or_create` / `open_plugin` 对含 `/` `\` `..` 的 pluginId MUST `schema`。
2. 不得创建对应目录。
3. 不进 boot，不迁 `note_cards`。

## Capabilities

- `plugin-storage-path-safe-id-v1`
