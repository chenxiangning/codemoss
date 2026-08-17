# Proposal: project-map-plugin-pilot-manifest

> OpenSpec change id: `project-map-plugin-pilot-manifest`  
> Wave：5B（第三根插头 · Contract 草稿 · P4.7-31）  
> 依赖：`project-map-plugin-pilot-inventory`、`plugin-manifest-v1-parser`  
> 架构：[`14` §10 / §12](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)、[`15`](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md) §3 step 2

## Why

5A 已钉死 24 条 command 与 memory persist/panel 跟 map 走。现有 `packages/plugin-project-map/.mossx-plugin/plugin.json` 只示范 1 个 view，没有 command，也没有 memory 右栏。若不另写 exact Pilot Manifest，5C adapter 会发明字段，或把 re-export 门面撑成假合同。本刀只把 `com.mossx.project-map` 写成可被 `parseManifestV1` 接受的 fixture，不接 Host、不迁表、不 Slim。

## 目标与边界

1. 落下 `packages/plugin-contract/fixtures/valid/project-map-pilot.json`。
2. 保留 `packages/plugin-project-map/.mossx-plugin/plugin.json` 作为 Wave 0 过渡仓最小门面，不被本刀撑胖。
3. contributions：exact `mossx.ui.view`（`project-map.main`）+ exact `mossx.ui.panel`（`project-map.memory`）+ 24 条 exact `mossx.command`（commandId 对齐 inventory）。
4. 激活用 `onView` / `onCommand`；**禁止** `onStartup`。
5. trusted-react 仅 system 知识地图 / memory 面板允许；无 `mossx.engine.provider`。
6. storage 只声明目标包络（`sqlite-v1` + checkpoint）；产品仍写 Core 文件。
7. `parseManifestV1` 在 `trustTier=system` 下成功。
8. `src-tauri/src/project_map*` / `project_memory*` 与 frontend 零行为 diff。

## 非目标

- Host 假激活（5C）
- 迁 `~/.ccgui/project-map` / `project-map-relations` / `project-memory` 到 plugin namespace
- 改产品 `command_registry`
- 把 `@mossx/plugin-project-map` 从 re-export 升级成抽出
- 搬 memory-pick conversation inject
- Slim / Marketplace / 改 Claude / Notes owner

## What Changes

- 新增 Pilot fixture：`packages/plugin-contract/fixtures/valid/project-map-pilot.json`
- parser 单测接受该 fixture；拒绝 template 化 `mossx.command`
- 进度看板与缺口链记下 5B Contract 已落地，下一步只能是 5C Adapter
- 无产品代码行为变更

## 技术方案（对比）

| 选项 | 做法 | 取舍 |
|---|---|---|
| A. 另写 `project-map-pilot.json`（本 change） | 过渡仓 `plugin.json` 保持 1 view 门面 | 对标 Notes 4B：最小合同与 inventory 合同分离，parser 语义不漂 |
| B. 把 24 条 command 写进 `packages/plugin-project-map/.mossx-plugin/plugin.json` | 门面变假合同 | 过渡仓会被误读成已抽出；AppShell 只改 import 的事实被淹没 |
| C. 跳过 Manifest，直接写 adapter | 5C 发明 contribution id / slot | 违反 `15` §3；Search / memory-pick 容易被顺手拖进来 |

选 A。

## Capabilities

### New Capabilities

- `project-map-plugin-manifest-v1`：知识地图 Pilot exact view + memory panel + 24 commands

### Modified Capabilities

- 无。本刀不改产品 requirement。

## Impact

- 合同：`packages/plugin-contract/fixtures/valid/project-map-pilot.json`
- 测试：`src/plugin-kernel/parseManifestV1.test.ts`
- 文档：`16-progress-dashboard.md`、缺口链 4b
- 代码：无 `project_map*` / `project_memory*` / `src/features/project-map` 行为 diff
- 运行时：Host slot 仍 idle；Marketplace 仍关

## 验收标准

1. `pluginId` 为 `com.mossx.project-map`。
2. 24 个 inventory commandId 均 exact 出现。
3. 含 `project-map.main` view 与 `project-map.memory` panel；无 `onStartup`、无 engine.provider。
4. parser 接受；template 化 `mossx.command` 被拒绝。
5. 过渡仓 `packages/plugin-project-map/.mossx-plugin/plugin.json` 不被撑胖。
6. 本 change 不修改知识地图 / memory 生产实现。
7. `openspec validate project-map-plugin-pilot-manifest --strict` 通过。
