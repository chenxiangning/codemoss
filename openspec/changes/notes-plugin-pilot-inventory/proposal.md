# Proposal: notes-plugin-pilot-inventory

> OpenSpec change id: `notes-plugin-pilot-inventory`  
> Wave：4A（第二根插头 · 只盘点）  
> 依赖：Wave 2 Storage 合同、Wave 3 Claude 门面已停在默认 off  
> 架构：[`14` §17](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)、[`15`](../../../docs/architecture/plugin-platform/15-implementation-wave-plan.md)

## Why

Claude 已有 Inventory → Contract → 假激活 → 门面 → 默认 off 切流。按插头协议，第二根插头同样先盘点。Notes 文件与 Release Notes / conversation capture 缠在一起，不先钉死会误迁更新日志或整库 `client_storage`。

## 目标与边界

1. 落下 `inventory/notes-pilot.json` + md。
2. 标明 stay-in-Core / 目标迁出 / 禁止跟随。
3. **不修改** `note_cards.rs` 与 frontend note-cards 生产行为。
4. 不 disable Claude，不写 `plugin-runtime/data`。

## 非目标

- Notes Manifest 修订（4B）
- 真实 sqlite 迁表
- Host 激活 Notes
- Marketplace

## Capabilities

### New Capabilities

- `notes-plugin-pilot-inventory`：Notes 插头可核对归属表

## 验收标准

1. `pluginId` 为 `com.mossx.notes`。
2. commands 列出 7 条 `note_card_*`。
3. `mustNotMoveWithNotes` 含 Release Notes 与 `engine/claude*`。
4. 本 change 无 `src-tauri/src/note_cards.rs` 行为 diff。
5. `openspec validate` 通过。
