# Proposal: project-map-plugin-dual-run-isolated

> OpenSpec change id: `project-map-plugin-dual-run-isolated`  
> Wave：P4.7 Wave 5E 切流（第三根插头 · flag-on 走隔离 sqlite）  
> 依赖：`project-map-plugin-isolated-storage`  
> 架构：`15` §3 Dual-run。同一时刻只有一个 owner。

## Why

5D 把 24 条命令接到门面，但 flag on/off 都 delegate 到 `*_core` 文件。5E2 已有隔离 `ProjectMapNamespace` persist CRUD，却接不进产品命令。这不是 Dual-run。

本刀：`MOSSX_PROJECT_MAP_COMPAT_FACADE` 打开时，persist 命令走隔离 sqlite（`app_home/plugin-runtime/data/com.mossx.project-map/store.sqlite`）。flag 关闭 MUST 仍走 `*_core` 文件。不迁存量，不开默认 flag，不 Disable，不装/卸。

## What Changes

- Adapter 增加 `IsolatedProjectMap` owner + `isolated(root)` / `isolated_product()`
- flag-on 产品命令改走 `isolated_product()`，persist 读写 namespace
- compute-only（embed health/text/download/remove）仍走 Core；`relationship_scan` 用 Core `scan_workspace` 写 temp 再导入 blob
- 本刀 MUST NOT 默认开 flag、MUST NOT Disable、MUST NOT 扩 allowlist

## 目标与边界

1. flag on MUST 读写隔离 namespace，MUST NOT 写 `~/.ccgui/project-map*` / `project-memory` 产品目录。
2. flag off MUST 仍是产品文件路径。
3. 24 条命令 MUST NOT 变成第二套实现；persist 存 blob/表，compute 复用 Core。
4. **MUST NOT** 迁存量，**MUST NOT** 默认开 flag，**MUST NOT** Slim，**MUST NOT** Disable / D-052。

## 非目标

- 产品默认隔离（下一刀：flag default on，`0` 回 Core 文件）
- Core owner Disable
- D-052 真实装/卸与插排第三组按钮
- 可视化插排

## Capabilities

### New Capabilities

- `project-map-plugin-dual-run-isolated-v1`: flag-on persist 走隔离 sqlite

### Modified Capabilities

- 无。本刀不改主 specs 既有 requirement。

## Impact

- `src-tauri/src/plugin_runtime/project_map_compat.rs`
- 产品命令入口：`project_map.rs` / `project_map_relations.rs` / `project_memory/commands.rs` / `embed_index.rs`
- persist 类型 `pub(crate)` 组装面
- 测试：隔离闭环不碰产品路径；flag 默认仍关

## 验收标准

- Isolated adapter write/read 闭环，路径含 `com.mossx.project-map/store.sqlite`，不含产品目录
- `project_map_compat_facade_enabled_from(None)` 仍为 false
- flag-on 产品命令源码走 `isolated_product()`，flag-off 仍走 `*_core`
- `openspec validate project-map-plugin-dual-run-isolated --strict --no-interactive`
