# Proposal: plugin-kernel-ownership-inventory

> OpenSpec change id: `plugin-kernel-ownership-inventory`
> Wave：0A（插排图纸）
> 架构：[`docs/architecture/plugin-platform/15-implementation-wave-plan.md`](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)
> Contract：[`docs/architecture/plugin-platform/14-v1-contract-freeze.md`](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

插件化主线已经冻结 Contract，但当前工作树仍是完整单体：62 个 frontend feature、7 个 Engine、未收缩的 Native command 面。文档 13 描述的 Core Shell 减法**没有**落在本工作树。若直接按 13 整树删除，会把还在用的 CLI / 数据路径一起炸掉。

实施第一件事必须是可核对的 ownership inventory + fitness check：先标清插座和插头，再允许任何产品删除。

## 目标与边界

1. 产出当前 feature / engine / storage / process / command 的 ownership inventory，按 `core` / `pilot` / `later-plugin` / `retired-unreferenced` 分类。
2. 建立可执行的 Core Boundary fitness checks：禁止 AppShell 直接 import 已标 `later-plugin` 的内部实现（本 Wave 先 warn 或只对 `retired-unreferenced` fail）；禁止 Core 启动测试依赖 Marketplace。
3. 修正文档 13：标明它是本机减法实验，不是本工作树现状。
4. 只删除 **已证明无引用** 的空目录 / 死脚本 / 过期断言。不删除任何用户可见功能。

## 非目标

- 不实现 Extension Host / Worker / Marketplace。
- 不迁出 Claude / Notes / 任何 CLI。
- 不把 `EngineType` 收成只剩 Claude。
- 不改 Native command allowlist 的生产行为。
- 不做 Marketplace UI。

## 技术方案对比

| 方案 | 做法 | 取舍 |
|---|---|---|
| A. 按文档 13 整树删空再加回 | 先变成 Core Shell | 工作树不是那份减法；7 个 Engine 与用户数据会一起断；没有插座 |
| B. 边做 Host 边随手标 owner | 不单独 inventory | 后续拔插头时双写、漏删、漏测 |
| **C. 先 inventory + fitness，再允许插头级删除（采用）** | 图纸先行，瘦身只删无引用 | 慢半步，但可回退、可验收 |

## Capabilities

### New Capabilities

- `plugin-ownership-inventory`：Core / Plugin 归属表、分类枚举、与 fitness check 的对应关系
- `core-boundary-fitness`：防止 Core 反向膨胀的可执行检查

### Modified Capabilities

无。本 Wave 不改已有产品行为 spec。

## Impact

- 新增：`docs/architecture/plugin-platform/inventory/` 或等价表格；`scripts/check-core-shell-boundary.mjs` 的 **inventory 模式**（先记录，不对仍在用的 feature fail）
- 文档：修正 `13`；`15` 已存在
- 代码：最多删除空目录 `src/core-shell/`、无引用脚本；禁止删 `src/features/**` 产品代码
- 测试：fitness script 的 fixture（伪造 AppShell import retired owner 必须失败）

## 验收标准

1. inventory 覆盖全部 `src/features/*` 与 `src-tauri/src/engine/*` 顶层 owner，每行有分类与目标 `pluginId`（若适用）。
2. `retired-unreferenced` 集合为空或已删除；删除项必须附引用扫描证据。
3. fitness script 对“伪造 retired import”失败，对当前工作树（产品仍在）通过。
4. 文档 13 不再声称本工作树已经减成 Core Shell。
5. `openspec validate plugin-kernel-ownership-inventory --strict --no-interactive` 通过。
6. 现有 `npm test` / `cargo test --lib` 不因本 change 变红。
