# Design: project-map-plugin-pilot-inventory

## Context

Wave 5 第一根 later-plugin 是知识地图。当前事实：

- 产品实现仍在 `src/features/project-map`、`src/features/project-memory`、`src-tauri/src/project_map*.rs`、`project_memory/`。
- `@mossx/plugin-project-map` 只 re-export Core；`plugin-project-map-export-surface` 已让 AppShell / 布局走包入口，源码未搬家。
- `ownership.json` 已把 `frontend.project-memory` 与 rust `project_memory` 标到 `com.mossx.project-map`。
- `project_canvas` 与 intent-canvas 同域，不是知识地图。
- Search radar / Quick Switcher 消费 map 类型，但 Search 本身是 Core。
- Claude / Notes 已 disable-not-delete；本插头 Core owner 仍是 Active。

## Goals / Non-Goals

**Goals:**

- 给出可核对的归属表：谁跟 map 走、谁留 Core、谁只记账。
- 把 re-export 写成「门面 ≠ 抽出」，避免下一刀误删 Core。
- 遵守 `15` §3 step 1 Inventory，不跳到 Contract / Slim。

**Non-Goals:**

- 改生产读写、命令、UI、i18n、CSS。
- 激活 Host 或 Marketplace。
- 把 memory-pick 从 conversation 拆走。

## Decisions

### D1. project-memory persist / panel 跟 map 走

`ownership.json` 已归到同一 `pluginId`。settings / list / embed / 面板与 `~/.ccgui/project-memory` 记入目标迁出。

备选：单独 `com.mossx.project-memory`。拒绝——存储与 map 证据/ingestion 缠在一起，拆两个插头会双迁。

### D2. memory-pick conversation inject 只记账，不搬

`MemoryPickGateHost`、`messagesMemoryContext`、`composer.memory-picker.css`、`i18n/*/memory.ts` 的 pick 文案挂在 conversation / composer。5A 记入 `bookedNotMoved`，抽出时另开 change。

备选：本刀把 inject 标成 must-move。拒绝——会把 Messages / Composer 拖进知识地图。

### D3. intent-canvas / project_canvas / Search / AppShell 留 Core

`project_canvas_*` 是画布文件，不是 map snapshot。Search 与 AppShell 槽位是平台面；它们 import `@mossx/plugin-project-map/*` 只是消费门面。

### D4. re-export 不是抽出

`packages/plugin-project-map` 与 AppShell 改 import 已发生。inventory 必须写 `packageRole: re-export-facade`。不得据此宣称 Host 已激活或 Core 可删。

### D5. 本刀零产品行为

不改 rust / TS 生产路径。不新增 disable flag。`disable.rs` 对 later-plugin 仍报 Active。

## Risks / Trade-offs

- [误把 re-export 当抽出] → JSON 写明 `packageRole`，spec 用 scenario 锁住
- [误迁 intent-canvas] → `mustNotMoveWithProjectMap` 显式列出 `project_canvas` 与 intent-canvas
- [误迁 Search / AppShell] → stay-in-Core 列出 search 与 `src/app-shell/**`
- [提前 Slim Claude/Notes] → 缺口链继续写 1y 禁止

## Migration Plan

无产品迁移。回滚 = 删本 change 的 inventory 文档。

## Open Questions

无。下一刀只能是 5B Manifest / storage contract 盘点，不得 Slim。
