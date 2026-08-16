# Proposal: plugin-notes-package-layer

> OpenSpec change id: `plugin-notes-package-layer`

## Why

Notes 已是 Feature Pilot。第一步只在当前仓库分包分层，不迁 `note_cards`，不进 boot。

## 目标与边界

1. 增加 `packages/plugin-notes` 过渡仓，`pluginId` 为 `com.mossx.notes`。
2. 产品实现仍留 `src/features/note-cards` 与 `note_cards.rs`。
3. MUST NOT 迁表、MUST NOT 远程安装、MUST NOT 进 boot。

## Capabilities

- `plugin-notes-package-layer-v1`
