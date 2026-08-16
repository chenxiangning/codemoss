# Wave 3K Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-shutdown-facade`  
> 论文对齐：unload 是 load 的逆操作。  
> 结论：**方向正确。shutdown / list 已接到默认 off 门面。** GUI exit、daemon shutdown、runtime exit list、diagnostics list 不再直打 `claude_manager`。未改 askuser MCP / shared_session_v2。未删 `engine/claude*`。未开产品 flag。

## 证明

- `plugin_runtime::claude_compat`：9 passed
- `engine::manager::tests`：13 passed
- `openspec validate engine-claude-shutdown-facade --strict --no-interactive`

## 下一刀

3L：`shared_session_v2` / `session_lifecycle` / Codex 旁路直调改走门面 lookup。禁止从此处删 Claude。
