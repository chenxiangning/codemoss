# Design: project-map-plugin-isolated-storage

```text
ProjectMapNamespace（注入根 sqlite）
  map_files        workspace_id + relative_path + content
  relation_files   workspace_id + relative_path + content
  memory_items     id + workspace_id + payload_json
  memory_settings  单行 payload_json
  embed_index      workspace_id + memory_id + payload_json
  checkpoint / restore 复用 DiskStorage

产品
  24 条 command → ProjectMapCompatAdapter::core() 或 *_core
  本刀零改动
```

## 决策

- map / relations 不拆 JSON 列：产品本来就是相对路径文件，blob 足以让 restore 带回快照。
- memory / settings / embed-index 用表 + `payload_json`，避免把 24 条 command 的字段模型抄第二遍。
- 测试只注入 temp 根。禁止 `app_paths`、禁止读 `~/.ccgui`。

## 不在本刀

- `IsolatedProjectMap` owner
- flag on 写隔离库
- `import_legacy_once`
- Disable / allowlist
