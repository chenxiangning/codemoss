# Proposal: project-map-product-default-isolated

> OpenSpec change id: `project-map-product-default-isolated`  
> Wave：P4.7 Wave 5E 产品默认隔离  
> 依赖：`project-map-plugin-dual-run-isolated`  
> 架构：`15` §3 Dual-run。flag-on persist 已切隔离 sqlite，默认路径才能切。

## Why

5E 切流已通：flag 开时 24 条 persist 命令写隔离 sqlite。旗仍默认关，用户日常仍走 `~/.ccgui/project-map*` / `project-memory`。这不是真插头。

本刀把未设 `MOSSX_PROJECT_MAP_COMPAT_FACADE` 视为 on。显式 `0/false` 回 `*_core`。首次打开跑 `import_legacy_once`。不删源文件，不 Slim，不 Disable，不装/卸。

## 目标与边界

1. `project_map_compat_facade_enabled_from(None)` MUST 为 true。
2. 显式关闭 MUST 仍走 `*_core`。
3. 默认路径 MUST 写隔离 sqlite，MUST NOT 双写。
4. 首次 `isolated_product()` MUST 导入存量 map / relations / memory，源文件保留。
5. **MUST NOT** Slim，**MUST NOT** Disable，**MUST NOT** 开 D-052。

## Capabilities

- `project-map-product-default-isolated-v1`
