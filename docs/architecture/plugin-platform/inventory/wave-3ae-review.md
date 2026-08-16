# Wave 3AE Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-history-catalog-inventory`  
> 论文对齐：catalog 用 attribution / source facts，不是 GUI list。  
> 结论：**方向正确。只盘点，不接门面，不删实现。** catalog list / source facts / catalog delete / native resolve 已钉死。不能把 catalog 硬接到 GUI `list_claude_history_sessions`。未开产品 flag。

## 证明

- `plugin_runtime::claude_compat`：14 passed
- `engine::manager::tests`：13 passed
- `openspec validate engine-claude-history-catalog-inventory --strict --no-interactive`

## 下一刀

3AF：默认 off 的 catalog list 门面，接 `list_claude_sessions_for_attribution_scopes_with_config`。禁止从此处删 `claude_history*`。
