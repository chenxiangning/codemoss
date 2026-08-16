# Proposal: engine-claude-askuser-facade

> OpenSpec change id: `engine-claude-askuser-facade`  
> Wave：3N（第一根插头 · askuser MCP / diagnostic sink 走门面）  
> 依赖：`engine-claude-respond-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3M 把 Codex / daemon respond 接到门面。askuser MCP 初始化仍 clone `claude_manager`，resume diagnostic sink 也直打 Core manager。MCP lookup 绕过门面，双路径无法单独回滚。

## 目标与边界

1. `EngineManager` MUST 提供 `claude_ask_lookup` 与 `set_claude_ask_user_question_resume_diagnostic_sink`；flag on 时经门面。
2. `lib.rs` 启动 MCP MUST 用 `claude_ask_lookup`，MUST NOT clone `claude_manager`。
3. `state.rs` MUST 经 EngineManager 设 diagnostic sink。
4. MCP 内部 lookup MUST 走 `ClaudeAskLookup`，MUST NOT 再握 `ClaudeSessionManager` 字段名。
5. MUST NOT 默认开 flag、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace。

## Capabilities

- `engine-claude-askuser-facade-v1`
