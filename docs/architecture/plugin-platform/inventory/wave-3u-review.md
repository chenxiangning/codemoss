# Wave 3U Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-history-hydrate-facade`  
> 论文对齐：hydrate 是磁盘 JSONL 的延迟读；flag 切调用路径，不换实现。  
> 结论：**方向正确。GUI `hydrate_claude_deferred_image` 已走默认 off 门面。** 仍读同一份 `hydrate_claude_deferred_image_with_config`。未删实现。未开产品 flag。

## 证明

- `plugin_runtime::claude_compat`：14 passed
- `engine::manager::tests`：13 passed
- `openspec validate engine-claude-history-hydrate-facade --strict --no-interactive`

## 下一刀

3V：GUI `fork_claude_session` 走同一套 history 门面。禁止从此处删 `claude_history*`。
