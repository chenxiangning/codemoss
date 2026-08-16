# Wave 3AP Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-flag-on-call-path-tests`  
> 论文对齐：flag 切调用路径，不换实现；默认配置不得激活任何 fiber。  
> 结论：**方向正确。只证明调用路径，不切产品。** `new_with_claude_compat(true)` 的 history handle 走门面；flag off 走同一份 `claude_history`。未设 env 时门面仍关。未删 `engine/claude*`。

## 证明

- `plugin_runtime::claude_compat`：15 passed
- `engine::manager::tests`：14 passed
- `openspec validate engine-claude-flag-on-call-path-tests --strict --no-interactive`

## 下一刀

3AQ：产品默认构造仍 off 的启动链证据盘点。禁止从此处默认开 flag、删 `engine/claude*`。
