# plugin-notes

Pointer。`pluginId`：`com.mossx.notes`。

- **artifact owner**：独立仓 `mossx-plugin-notes`（本机磁盘，不在本 monorepo）
- 本包只保留 `@mossx/plugin-notes/runtime` 与 `@mossx/plugin-notes/ui` re-export
- 产品 IPC / Trusted React 仍编译在 Core：`src/features/note-cards`、`src-tauri/src/note_cards.rs`
- 不进 boot；产品安装走市场一键 fixture 或「从本地仓库安装」stage

0.8.9 Slim 口径：manifest / 发布树所有权已离开 Core。删 Core IPC/UI 不是本轮范围。
