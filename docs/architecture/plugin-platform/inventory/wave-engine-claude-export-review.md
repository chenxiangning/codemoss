# Wave Claude Export Surface Self-Review

> 日期：2026-08-16  
> 范围：`plugin-engine-claude-export-surface`  
> 结论：**方向正确。AppShell / 会话 / 模型改走 `@mossx/plugin-engine-claude/runtime`。** `engine/claude*` 仍在。未默认开 facade。未激活 Host。

## 证明

- `openspec validate plugin-engine-claude-export-surface --strict --no-interactive`
- vitest 包出口 + composer model + managed runtime + resume command：34 passed
- `src-tauri/src/engine/claude.rs` / `claude_history.rs` 仍存在
