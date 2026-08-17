# Proposal: project-map-plugin-compat-adapter

> Wave：5C（第三根插头 · 单 owner 门面 · P4.7-32）  
> 依赖：5A inventory、5B Manifest  
> 架构：[`15`](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md) §3 step 3

## Why

知识地图已有 inventory 与 exact Pilot fixture，但产品路径仍直调 `project_map*` / `project_memory*`。5C 加 `ProjectMapCompatAdapter`，exact 声明 24 条 command，默认 off。不迁表、不改 `command_registry`、不接 Host、不假装装/卸。

方向已校准：第三根要推到 Claude / Notes 同级（Disable + 真实 install/uninstall）再停。本刀只走 Adapter，不跳 Dual-run / Disable / Rack 可写。

## 边界

1. `pluginId=com.mossx.project-map`，owner 仅 `CoreProjectMap`。
2. commandId 对齐 inventory 的 24 条 `project_map_*` + `project_memory_*`。
3. `MOSSX_PROJECT_MAP_COMPAT_FACADE` 默认 off。
4. 测试用内存 backend，不读 `~/.ccgui/project-map*` / `project-memory`。
5. 不改 `project_map*` / `project_memory*` 生产行为。
6. 不改 Claude / Notes owner，不碰另外 9 根 later-plugin。

## Capabilities

- `project-map-plugin-compat-adapter-v1`

## 验收

1. facade pluginId 与 `project-map-pilot.json` 一致。
2. 24 个 commandId 齐全，顺序与 inventory 一致。
3. 未设 env → flag false。
4. 内存 backend 两次 read 同一份数据。
5. `src-tauri/src/project_map*` / `project_memory*` 与 frontend 零行为 diff。
6. `openspec validate project-map-plugin-compat-adapter --strict` 通过。
