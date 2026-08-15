# Wave 4A Self-Review

> 日期：2026-08-16  
> 范围：`notes-plugin-pilot-inventory`  
> 结论：**方向正确。停在 Inventory。** 下一刀才是 Notes Manifest 核对（4B），不是迁 `note_cards` 表。

## 方向

| 检查 | 结果 |
|---|---|
| 只盘点不搬家 | 通过。无 Notes / Claude 生产代码 diff |
| 第二根插头是 Notes | 通过。`pluginId=com.mossx.notes` |
| Release Notes 不跟随 | 通过 |
| Claude 不跟随 / 不 disable | 通过 |
| 未写 plugin-runtime/data | 通过 |

## 扫描摘要

- 文件名含 note/notes：36（含 Release Notes，已剔除出迁出集）
- `note_card_*` commands：7
- 后端单文件：`src-tauri/src/note_cards.rs`

## 下一阶段边界（锁定）

**4B：核对并补齐 `notes-minimal.json` exact contributions。**  
仍不接 App 启动、不迁表、不 disable Claude。
