# Design

`StorageService::access` / `DiskStorage::access_file` 先比 caller 与 target。相等才返回已有 namespace 或 data_file。不改 `open_or_create` 签名，避免打爆 2A/2B 单测。
