# Design: plugin-storage-sqlite-temp-v1

## Decisions

### D1. 根目录注入

`DiskStorage::open(root: PathBuf)`。测试传 `tempdir`。生产路径映射留给 Wave 3/4 installer，本 change 不选默认用户目录。

### D2. 文件布局

```text
<root>/
  plugin-runtime/
    data/<pluginId>/store.sqlite
    checkpoints/<pluginId>/<ckpt-id>/store.sqlite
```

### D3. schema 存在 sqlite user_version 或 meta 表

用单表 `mossx_storage_meta(key, value)` 记 `schema_version`。不引入 rusqlite 新依赖之外的东西——crate 已有 `rusqlite`。

### D4. 闸门仍走 2A

`DiskStorage` 先问内存 `StorageService` 能不能 migrate，再动文件。
