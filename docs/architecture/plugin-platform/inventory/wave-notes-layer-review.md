# Wave Notes Package Layer Self-Review

> 日期：2026-08-16  
> 范围：`plugin-notes-package-layer`  
> 结论：**方向正确。Notes 只做仓库内分包分层。** `note_cards.rs` 仍在。boot 不安装。

## 证明

- `openspec validate plugin-notes-package-layer --strict --no-interactive`
- parser 接受 `packages/plugin-notes/.mossx-plugin/plugin.json`
- boot.rs 不含 `plugin-notes`
