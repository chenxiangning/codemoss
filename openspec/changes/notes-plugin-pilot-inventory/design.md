# Design: notes-plugin-pilot-inventory

## Decisions

### D1. Release Notes 不是 Notes 插头

`features/update/*ReleaseNotes*` 留在 Core 更新面。

### D2. conversation capture 跟 Notes 走，但 4A 只记账

capture hook 依赖 note-cards facade，抽出时一并迁；本刀不改调用。

### D3. 不碰 Wave 2 DiskStorage

4A 不把 `note_cards` 接到 `plugin-runtime/data`。
