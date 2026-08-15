# Notes Pilot Inventory（Wave 4A）

> pluginId：`com.mossx.notes`  
> 状态：**inventory-only**。本刀不迁表、不双写、不 disable Claude。

## 必须留下的 Core

`app_paths`、workspace identity、`command_registry` 生成器、AppShell 槽位。Notes 抽出后这里只留 slot + typed storage API。

## 目标迁出（稳定后 disable-not-delete）

| 层 | 落点 |
|---|---|
| Persistence + commands | `src-tauri/src/note_cards.rs`（7 条 `note_card_*`） |
| Workspace UI | `src/features/note-cards/**` |
| IPC client | `src/services/tauri/noteCards.ts` |
| Conversation capture | `useConversationNoteCaptureMenu` / `messagesNoteCardContext` |
| i18n | `noteCards.ts` × locales |

## 禁止跟 Notes 一起走

- 产品 Release Notes（`features/update/**`）
- Claude / 其他 CLI
- Wave 1–3 的 `plugin_runtime` 插座本身
- 共享 `client_storage` 整库

## 拔插头下一步（另开 change）

4B：确认 `packages/plugin-contract/fixtures/valid/notes-minimal.json` 仍被 parser 接受，并补 Notes exact contributions（仍不接 Host 生产路径）。  
禁止从 4A 跳到迁 `note_cards` 表。
