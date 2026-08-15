# Wave 4B Self-Review

> 日期：2026-08-16  
> 范围：`notes-plugin-pilot-manifest`  
> 结论：**方向正确。停在 Contract 草稿。** 下一刀才是 Host 按 `notes-pilot.json` 假激活（4C），不是迁表。

## 方向

| 检查 | 结果 |
|---|---|
| exact view + 7 commands | 通过。commandId 对齐 inventory |
| 未撑胖 `notes-minimal.json` | 通过。基线仍给 Wave 0B |
| 无 onStartup / 无 engine.provider | 通过 |
| 不改 `note_cards.rs` / Claude | 通过 |
| parser | 通过。vitest 17 |

## 颗粒度

4B 只多了一份 fixture + 两则单测。没有 Host、没有 DiskStorage、没有 disable Claude。这是插头协议第 2 步。

## 下一阶段边界（锁定）

**4C：用现有 Host + FakeDriver 激活 `notes-main` unit。**  
仍禁止迁 `note_cards`、禁止产品路径、禁止 disable Claude。
