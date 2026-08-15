# Design: plugin-storage-checkpoint-v1

## Decisions

### D1. 纯内存 Store

```text
StorageService
  namespaces: Map<pluginId, Namespace>
Namespace
  pluginVersion
  contractVersion
  storageSchemaVersion
  checkpointFormatVersion
  checkpoints: Vec<CheckpointMeta>   # newest last
  lastExport: Option<schemaVersion>
```

路径只生成字符串，不 `create_dir`。

### D2. 操作顺序

`plan_update` → `checkpoint` → `migrate` → 失败则 `restore`。缺 checkpoint 的 migrate 直接 `checkpoint-required`。

### D3. retainPrevious

默认 2，范围 1–5。超出时丢掉最旧 checkpoint 元数据。

### D4. 不进 boot

仅被单测调用。
