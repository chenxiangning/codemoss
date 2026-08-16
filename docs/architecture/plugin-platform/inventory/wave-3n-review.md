# Wave 3N Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-askuser-facade`  
> 论文对齐：隔离 = 独立上下文；MCP lookup 绕过门面等于未声明依赖。  
> 结论：**方向正确。AskUser MCP / resume diagnostic 已接到默认 off 门面。** `lib.rs` 不再 clone `claude_manager`。MCP 内部走 `ClaudeAskLookup`。未删 `engine/claude*`。未开产品 flag。

## 证明

- `plugin_runtime::claude_compat`：12 passed
- `engine::manager::tests`：13 passed
- `engine::claude::askuser_mcp`：3 passed
- `openspec validate engine-claude-askuser-facade --strict --no-interactive`

## 下一刀

3O：`EngineManager.claude_manager` 仍是 pub 字段，`set_config` 仍直打。下一刀把 config 也接到门面，并盘点剩余 pub 字段调用。禁止从此处删 Claude。
