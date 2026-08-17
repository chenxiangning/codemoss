# Wave P4.7-32 Self-Review

> 日期：2026-08-17  
> 范围：`project-map-plugin-compat-adapter`  
> 结论：**方向正确。只加 `ProjectMapCompatAdapter`。默认 off。不接 Host。不假装装/卸。不切产品 command。**

下一刀：知识地图 Dual-run。不跳 Disable，不加 Rack 按钮。

## 证明

- OpenSpec change `project-map-plugin-compat-adapter`
- `src-tauri/src/plugin_runtime/project_map_compat.rs`
- `cargo test --lib plugin_runtime::project_map_compat`
- `openspec validate project-map-plugin-compat-adapter --strict --no-interactive`

## 不做

- 不改 `command_registry` / `project_map*` / `project_memory*`
- 不给 `com.mossx.project-map` 加 Rack 安装按钮
- 不迁 `~/.ccgui/project-map*` / `project-memory`
- 不碰 browser / canvas / 其余 7 根 later-plugin
