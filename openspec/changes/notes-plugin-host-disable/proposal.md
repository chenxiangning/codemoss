# Proposal: notes-plugin-host-disable

> Wave：4F（第二根插头 · 插座级 disable-not-delete）  
> 依赖：4C 假激活、1B2 Host disable、3F Claude 对称刀

## Why

Notes 已有 Manifest / 假激活 / 默认 off 门面。合同下一步是 disable 插头，不是迁 `note_cards`。4F 只对 fixture 走 Host disable + Broker 拒绝，并证明产品 `note_cards.rs` 仍在。

## 边界

1. 激活 `com.mossx.notes` fixture 后 `disable`。
2. 再 activate / Broker read MUST 失败。
3. `src-tauri/src/note_cards.rs` MUST 仍存在。
4. 不改 command_registry，不读产品 Notes 目录。

## Capabilities

- `notes-plugin-host-disable-v1`
