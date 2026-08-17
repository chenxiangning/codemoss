# Tasks

- [x] 1.1 落盘 proposal + design + spec delta，明确「注入根 namespace」与「不迁产品目录」边界
- [x] 1.2 `openspec validate project-map-plugin-storage-namespace --strict --no-interactive`
- [x] 1.3 `open_project_map_namespace`：注入根打开 `com.mossx.project-map`
- [x] 1.4 测试：temp 根存在 sqlite；checkpoint 后 restore 回 schema 1；无产品路径
- [x] 1.5 `cargo test --lib plugin_runtime::project_map_storage`
- [x] 1.6 刷新 `16-progress-dashboard.md` 与 `openspec/changes/README.md`
