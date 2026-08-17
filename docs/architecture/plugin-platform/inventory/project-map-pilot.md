# Project Map Pilot Inventory（Wave 5A · P4.7-30）

> pluginId：`com.mossx.project-map`  
> 状态：**inventory-only**。产品 owner 仍是 Core。5B Pilot fixture 另文件；`@mossx/plugin-project-map` 只是 re-export，不是抽出。不 Slim。

## 必须留下的 Core

`app_paths`、`project_identity`、`command_registry` 生成器、AppShell 槽位、Search、Workspace。知识地图抽出后这里只留 slot + typed storage API。

## 当前事实（2026-08-17）

| 层 | 落点 | owner |
|---|---|---|
| Map snapshot + 2 条命令 | `src-tauri/src/project_map.rs` | Core Active |
| Relations + API contracts + 4 条命令 | `project_map_relations*` / `project_map_api_contracts*` | Core Active |
| Memory persist + 18 条命令 | `src-tauri/src/project_memory/` | 跟 map；仍 Core |
| Registry | `command_registry.rs` → `project_map_*` / `project_memory_*` | Core |
| Workspace UI | `src/features/project-map/**`、`ProjectMemoryPanel` | Core |
| IPC | `projectMapPersistence.ts`、`src/services/tauri/projectMemory.ts` | Core |
| 过渡仓 | `packages/plugin-project-map` re-export `src/features/project-map` | **门面，不是抽出** |
| AppShell / 布局消费 | `@mossx/plugin-project-map/runtime` 与 `/ui` | Core 槽位，只改 import |
| i18n | `locales/*/projectMap.ts`；settings 里 memory 存储文案 | 跟 persist/panel |
| CSS | `src/styles/project-map*.css`、`project-memory.css` | 跟 map / persist |

## 跟 map 走（目标迁出，本刀不搬）

- 知识地图图、证据、关系扫描、API contract 产物
- project-memory 设置 / CRUD / embed / 面板
- `~/.ccgui/project-map` 与 project-local `.ccgui/project-map`
- `~/.ccgui/project-map-relations` 与 project-local 对应目录
- `~/.ccgui/project-memory`

## 只记账，不搬

memory-pick 对话注入挂在 Messages / Composer：

- `src/features/project-memory/memoryPick/**`
- `MemoryPickGate*`、`MessagesCore` 里的 `MemoryPickGateHost`
- `messagesMemoryContext`、conversation-presentation 的 memory pack 解析
- `src/i18n/locales/*/memory.ts`、`messages.ts` 的 pick / pack 文案
- `composer.memory-picker.css`、`memory-pick-gate.css`

抽出知识地图时不得顺手拆 conversation。另开 change。

## 禁止跟 Project Map 一起走

- 意图画布（`src/features/intent-canvas`、`project_canvas.rs` / `project_canvas_*`）
- Search / Search radar（可消费 map 类型，Search 本身是 Core）
- AppShell 槽位与 Quick Switcher 导航状态
- `command_registry` 生成器
- Claude / Notes
- Wave 1–3 的 `plugin_runtime` 插座本身（`host.rs` / `boot.rs`）
- Marketplace / 可写插排

## Dual-run / owner

- 本插头 **没有** 产品 dual-run flag
- `disable.rs` 对 later-plugin 仍报 `Active`
- Claude / Notes 的 `0` 回退与本刀无关，不得改

## 拔插头下一步（另开 change）

5B Contract 已落到 `packages/plugin-contract/fixtures/valid/project-map-pilot.json`。5C Adapter 已落到 `src-tauri/src/plugin_runtime/project_map_compat.rs`，`MOSSX_PROJECT_MAP_COMPAT_FACADE` 默认 off。禁止从本刀跳到迁表、删 `src/features/project-map` 或 Slim Claude/Notes。下一刀只能是 Dual-run（仍默认 Core owner），不得假装装/卸，不得开另外 9 根 later-plugin。
