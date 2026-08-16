# Wave 3AA Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-history-daemon-hydrate-facade`  
> 论文对齐：远程路径必须走同一条门面；flag 切调用路径，不换实现。  
> 结论：**方向正确。daemon `hydrate_claude_deferred_image` 已走默认 off 门面。** 复用 3U 的 `hydrate_claude_history_image`。未改 daemon fork / delete。未删实现。未开产品 flag。

## 证明

- `plugin_runtime::claude_compat`：14 passed
- `engine::manager::tests`：13 passed
- `openspec validate engine-claude-history-daemon-hydrate-facade --strict --no-interactive`

## 下一刀

3AB：daemon `fork_claude_session` 走同一套 history 门面。禁止从此处删 `claude_history*`。
