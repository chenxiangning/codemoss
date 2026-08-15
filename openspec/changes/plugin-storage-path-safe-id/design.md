# Design

`StorageService::open_or_create` 在 canonical 检查之后拒绝含 `/` `\\` 或 `..` 的 pluginId。DiskStorage 复用同一闸门。
