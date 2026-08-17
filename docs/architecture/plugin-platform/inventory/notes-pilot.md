# Notes Pilot Inventory（Wave 4A 复核 · P4.7-19）

> pluginId：`com.mossx.notes`  
> 状态：**inventory + default-off facade**。产品 owner 仍是 Core `note_cards`。  
> 本刀不迁表、不双写、不 Slim、不 disable Claude。

## 必须留下的 Core

`app_paths`、workspace identity、`command_registry` 生成器、AppShell 槽位。Notes 抽出后这里只留 slot + typed storage API。

## 当前事实（2026-08-16 复核）

| 层 | 落点 | owner |
|---|---|---|
| Persistence + 7 条命令 | `src-tauri/src/note_cards.rs` | **产品唯一 owner** |
| Registry | `command_registry.rs` → `note_card_*` | Core |
| Workspace UI | `src/features/note-cards/**` | Core |
| IPC client | `src/services/tauri/noteCards.ts` | Core |
| Conversation capture | `useConversationNoteCaptureMenu` / `messagesNoteCardContext` | Core |
| i18n | `src/i18n/locales/*/noteCards.ts` | Core |
| default-off 门面 | `plugin_runtime/notes_compat.rs`（`MOSSX_NOTES_COMPAT_FACADE`） | 仍 delegate 回 `*_core` |
| Host fixture | `notes_pilot.rs` | 假激活，不调产品 |
| 隔离 namespace | `notes_storage.rs` → `plugin-runtime/data/com.mossx.notes/store.sqlite` | **不是**生产库 |

## 禁止跟 Notes 一起走

- 产品 Release Notes（`features/update/**`）
- Claude / 其他 CLI
- Wave 1–3 的 `plugin_runtime` 插座本身
- 共享 `client_storage` 整库
- 把隔离 sqlite 当成生产迁出

## Dual-run

- `MOSSX_NOTES_COMPAT_FACADE` 默认关 → 产品走 `note_card_*_core` 文件
- flag 打开 → `NotesCompatAdapter::isolated_product()` → `~/.ccgui/plugin-runtime/data/com.mossx.notes/store.sqlite`
- `MOSSX_CLAUDE_PROCESS_ENTRY` 默认关 → 产品走 `cmd.spawn()`
- 同一时刻只有一个 Notes owner；flag-on 不双写、不迁存量 markdown

## 拔插头下一步（另开 change）

禁止从本刀跳到迁 `note_cards` 表。下一刀只能是 Notes storage contract 或 Claude 产品默认路径仍 Core 的 conformance，不得 Slim。
