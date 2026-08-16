# Proposal: engine-claude-respond-facade

> OpenSpec change id: `engine-claude-respond-facade`  
> Wave：3M（第一根插头 · Codex / daemon respond 走门面）  
> 依赖：`engine-claude-lookup-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3L 把 shared session / lifecycle lookup 接到门面。Codex 旁路 `respond_to_*` 和 daemon `respond_to_server_request` 仍直打 `claude_manager`。control 响应绕过门面，双路径无法单独回滚。

## 目标与边界

1. Codex `respond_to_shared_control_request` 的 Claude 分支 MUST 调 `get_claude_session_if_present`。
2. Codex native `respond_to_server_request` 的 Claude 扫描 MUST 调 `claude_sessions_for_workspace`。
3. daemon `respond_to_server_request` 的 Claude 扫描 MUST 同样走该入口。
4. MUST NOT 改 askuser MCP、`lib.rs` 的 MCP 初始化、`set_ask_user_question_resume_diagnostic_sink`。
5. MUST NOT 默认开 flag、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace。

## Capabilities

- `engine-claude-respond-facade-v1`
