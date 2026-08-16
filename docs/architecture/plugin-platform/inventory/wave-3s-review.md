# Wave 3S Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-history-list-facade`  
> 论文对齐：history 是磁盘 JSONL，不是 runtime session；flag 切调用路径，不换实现。  
> 结论：**方向正确。GUI `list_claude_sessions` 已走默认 off 门面。** 仍读同一份 `claude_history::list_claude_sessions_with_config`。未删实现。未开产品 flag。

## 证明

- `plugin_runtime::claude_compat`：14 passed
- `engine::manager::tests`：13 passed
- `openspec validate engine-claude-history-list-facade --strict --no-interactive`

## 下一刀

3T：GUI `load_claude_session` 走同一套 history 门面。禁止从此处删 `claude_history*`。
