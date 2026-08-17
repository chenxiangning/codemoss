# Proposal: project-map-plugin-pilot-inventory

> OpenSpec change id: `project-map-plugin-pilot-inventory`  
> Wave：5A（第三根插头 · 只盘点 · P4.7-30）  
> 依赖：Claude / Notes 已停在 disable-not-delete；Slim / Marketplace 仍禁止  
> 架构：[`14` §17](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)、[`15`](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md) Wave 5「知识地图」

## Why

Claude 与 Notes 已走完 Inventory → … → Disable，协议第 8 步 Slim 仍禁止。按 `15` 一根根拔插头，下一根是知识地图 `com.mossx.project-map`。该域和 `project-memory`、intent-canvas、Search、AppShell 缠在一起；`@mossx/plugin-project-map` 只是 re-export，不是抽出。不先钉死归属，下一步会误迁画布、Search 或把包门面当成已插件化。

## 目标与边界

1. 落下 `inventory/project-map-pilot.json` + md。
2. 标明 stay-in-Core / 目标迁出 / 禁止跟随 / 只记账不搬的 conversation inject。
3. **不修改** `project_map*`、`project_memory*` 与 frontend project-map / project-memory 生产行为。
4. 不 disable project-map Core owner，不写 `plugin-runtime/data`，不激活 Host。

## 非目标

- Project Map Manifest 修订（5B）
- 把 `packages/plugin-project-map` 从 re-export 升级成真实抽出
- 迁 `~/.ccgui/project-map` / `project-memory` 到 plugin namespace
- Host 激活 `com.mossx.project-map`
- Slim / Marketplace
- 改 Claude / Notes owner 或 flag

## What Changes

- 新增 Wave 5A inventory 事实源：`docs/architecture/plugin-platform/inventory/project-map-pilot.json` + `.md`
- 在缺口链记下「第三根插头已盘点，下一步只能是 contract / 归属复核，不得 Slim」
- 无产品代码行为变更

## 技术方案（对比）

| 选项 | 做法 | 取舍 |
|---|---|---|
| A. 只盘点（本 change） | 写 inventory + OpenSpec，源码不动 | 遵守 `15` §3 step 1；re-export 不会被误读成抽出 |
| B. 直接抽 `src/features/project-map` 进包 | 搬家电但插座未通电 | 违反一根根拔；Search / AppShell / memory-pick 会一起断 |
| C. 先 Slim Claude / Notes | 删 Core 实现再开下一根 | `15` 明确禁止；`0` 回退会丢 |

选 A。

## Capabilities

### New Capabilities

- `project-map-plugin-pilot-inventory`：知识地图插头可核对归属表

### Modified Capabilities

- 无。本刀不改产品 requirement。

## Impact

- 文档：`docs/architecture/plugin-platform/inventory/project-map-pilot.*`、缺口链下一缺口备注
- 代码：无 `src/features/project-map` / `src/features/project-memory` / `src-tauri/src/project_map*` / `project_memory*` 行为 diff
- 运行时：Host slot 仍 idle；Marketplace 仍关

## 验收标准

1. `pluginId` 为 `com.mossx.project-map`。
2. `status` 为 `inventory-only`。
3. commands 覆盖 6 条 `project_map*` 与 18 条 `project_memory_*`。
4. `mustNotMoveWithProjectMap` 含 intent-canvas、`project_canvas`、Search、AppShell、Claude/Notes、Host/boot、Marketplace。
5. 明确 `@mossx/plugin-project-map` 是 re-export，不是抽出。
6. 本 change 无知识地图 / memory 生产行为 diff。
7. `openspec validate project-map-plugin-pilot-inventory --strict` 通过。
