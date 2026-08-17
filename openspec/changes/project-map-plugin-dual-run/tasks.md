# Tasks

- [x] 1.1 落盘 proposal + design + spec delta，明确「对标 4H 调用面收口」与「不接插件运行时」边界
- [x] 1.2 `openspec validate project-map-plugin-dual-run --strict --no-interactive`
- [x] 1.3 24 条命令抽 `*_core` + facade `core()` delegate（map 6 + memory 18）
- [x] 1.4 24 条命令入口 flag 分发（`MOSSX_PROJECT_MAP_COMPAT_FACADE` 默认 off）
- [x] 1.5 测试：默认 off；单 owner；facade 调 `*_core`；不调 activate/dispatch
- [x] 1.6 `cargo test --lib plugin_runtime::project_map_compat` + 聚焦 `project_map` / `project_memory`
- [x] 1.7 刷新 `16-progress-dashboard.md` 与 `openspec/changes/README.md`
