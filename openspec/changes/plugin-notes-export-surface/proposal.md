# Proposal: plugin-notes-export-surface

> OpenSpec change id: `plugin-notes-export-surface`

## Why

Notes 过渡仓只有 Manifest。产品导入仍直达 `src/features/note-cards`。下一步让布局 / composer / threads 走包出口，不迁 `note_cards`。

## 目标与边界

1. `@mossx/plugin-notes` MUST 再导出 Notes 产品入口。
2. 布局与会话生产导入 MUST 走该包。
3. 产品实现 MUST 仍在 `src/features/note-cards`，`note_cards.rs` MUST 仍在。
4. MUST NOT 迁表、MUST NOT 激活 Host。

## Capabilities

- `plugin-notes-export-surface-v1`
