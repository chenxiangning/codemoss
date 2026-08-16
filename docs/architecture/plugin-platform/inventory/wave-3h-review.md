# Wave 3H Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-compat-lifecycle`  
> 论文对齐：unload 是 load 的逆操作。  
> 结论：**方向正确。停在默认 off 的生命周期门面。** flag on 时 `remove_claude_session` / `interrupt_claude_sessions` 经同一份 Core manager。未删 `engine/claude*`，未开产品 flag。

## 证明

- `plugin_runtime::claude_compat`：6 passed
- `engine::manager::tests`：13 passed
- `openspec validate engine-claude-compat-lifecycle --strict --no-interactive`

## 下一刀

3I：产品 `engine_interrupt` / daemon 直调改走 `interrupt_claude_sessions`，仍默认 off。禁止从此处删 Claude。
