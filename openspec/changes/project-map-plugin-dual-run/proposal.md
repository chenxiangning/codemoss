# Proposal: project-map-plugin-dual-run

> OpenSpec change id: `project-map-plugin-dual-run`  
> Wave：5D（第三根插头 · 调用面 Dual-run · P4.7-33）  
> 依赖：`project-map-plugin-compat-adapter`（5C 单 owner 门面）  
> 对标：`notes-dual-run-call-surface`（Wave 4H，「默认 off 调用面已齐」）  
> 架构：[`15` §3 step 5 Dual-run](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

知识地图 5C 已有 `ProjectMapCompatAdapter`（单 owner `CoreProjectMap`、24 commandId、flag 默认 off），但产品 `project_map*` / `project_memory*` 命令入口仍直调 Core，门面只服务 fixture / 内存 backend。这使第三根停在协议 3/9，无法进入 Conformance / Disable。

本刀对标 Notes 4H（不是当前 Notes 默认 isolated 的产品态）：把 24 条命令的 Core 逻辑抽成 `*_core`，门面 delegate 到同一组函数，命令入口按 `MOSSX_PROJECT_MAP_COMPAT_FACADE` 切调用路径。flag 切的是**调用路径**，不是第二个实现。

## 目标与边界

1. 24 条 `project_map_*` / `project_memory_*` 命令把 Core 逻辑抽成 `pub(crate)` `*_core`；`ProjectMapCompatAdapter` 增加 24 个 delegate，各自调对应 `*_core`；`owner()` 恒为 `CoreProjectMap`。
2. 24 条命令入口加 flag 分发：默认 off → 直接 `*_core`（现有行为）；on → 经 facade → 同一 `*_core`。
3. **MUST NOT** 接插件运行时（不 activate / 不 dispatch / 不接 DiskStorage / 不迁 map/memory 目录）。
4. **MUST NOT** 删 `project_map*` / `project_memory*` / `src/features/project-map/**`（Slim 禁止）。
5. **MUST NOT** 默认开 flag、MUST NOT 开 Marketplace、MUST NOT 给 0/9 插头装按钮。
6. 产品行为 0% 变化：flag 默认 off，24 条命令走与当前完全一致的 Core 路径。

## Capabilities

- `project-map-plugin-dual-run-v1`

## 验收

1. 未设 env → `project_map_compat_facade_enabled()` 为 false，24 条走 `*_core`。
2. flag=`1` → 经 facade 调到同一组 `*_core`，不递归进命令入口。
3. `owner()` 恒为 `CoreProjectMap`；`command_registry` 仍指 Core 命令名。
4. 不 activate / dispatch；不读插件 storage namespace。
5. `openspec validate project-map-plugin-dual-run --strict --no-interactive` 通过。
