# Wave 3R Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-history-inventory`  
> 论文对齐：config 是真相；history 是磁盘 JSONL，不是 runtime session。  
> 结论：**方向正确。只盘点，不接门面，不删实现。** GUI / daemon / catalog / rewind / native continuation 调用面已钉死。Gemini / Grok / Kimi frontend parser 复用了 Claude loader，禁止跟 Claude 一起搬走。未开产品 flag。未迁 `note_cards`。

## 证明

- `plugin_runtime::claude_compat`：14 passed（含 inventory 断言）
- `engine::manager::tests`：13 passed
- `openspec validate engine-claude-history-inventory --strict --no-interactive`
- `src-tauri/src/engine/claude_history.rs` 仍存在

## 下一刀

3S：默认 off 的 history 门面，先接 GUI `list_claude_sessions`。禁止从此处删 `claude_history*`。
