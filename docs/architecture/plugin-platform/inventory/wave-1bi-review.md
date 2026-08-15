# Wave 1BI Self-Review

> 日期：2026-08-16  
> 范围：`plugin-storage-path-safe-id`  
> 结论：**方向正确。含 `/` `\\` `..` 的 pluginId 不得开 namespace，也不得穿越磁盘根。** 这是实洞。不进 boot，不迁 `note_cards`。
