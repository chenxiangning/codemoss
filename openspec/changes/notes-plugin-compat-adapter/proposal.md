# Proposal: notes-plugin-compat-adapter

> Wave：4E（第二根插头 · 单 owner 门面）  
> 依赖：4A inventory、4B Manifest

## Why

Notes 已有 inventory / Manifest / 假激活 / 隔离库，但产品路径仍直调 `note_cards::*`。4E 加 `NotesCompatAdapter`，声明 7 条 command，默认 off。不迁表、不改 command_registry。

## 边界

1. `pluginId=com.mossx.notes`，owner 仅 `CoreNotes`。
2. commandId 对齐 inventory 的 7 条 `note_card_*`。
3. `MOSSX_NOTES_COMPAT_FACADE` 默认 off。
4. 测试用内存 backend，不读产品 Notes 目录。
5. 不改 `note_cards.rs` 行为，不 disable Claude。

## Capabilities

- `notes-plugin-compat-adapter-v1`

## 验收

1. facade pluginId 与 fixture 一致。
2. 7 个 commandId 齐全。
3. 未设 env → flag false。
4. 内存 backend 两次 list 同一份数据。
5. `openspec validate` 通过。
