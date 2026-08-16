# Proposal: engine-claude-history-daemon-delete-facade

> OpenSpec change id: `engine-claude-history-daemon-delete-facade`  
> Wave：3AD（第一根插头 · daemon history delete 走默认 off 门面）  
> 依赖：`engine-claude-history-daemon-rewind-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3AC 把 daemon rewind 接到门面。daemon `delete_claude_session` 仍直调 `claude_history::delete_claude_session_with_config`。远程 delete 会绕过已收口的 GUI 门面。

## 目标与边界

1. daemon `daemon_state.rs::delete_claude_session` MUST 经 `EngineManager::delete_claude_history_session`。
2. MUST NOT 直调 `claude_history::delete_claude_session_with_config`。
3. 本刀 MUST NOT 改 catalog。
4. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-daemon-delete-facade-v1`
