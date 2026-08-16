# Proposal: engine-claude-history-daemon-list-facade

> OpenSpec change id: `engine-claude-history-daemon-list-facade`  
> Wave：3Y（第一根插头 · daemon history list 走默认 off 门面）  
> 依赖：`engine-claude-history-rewind-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3X 把 GUI rewind 接到门面。daemon `list_claude_sessions` 仍直调 `claude_history::list_claude_sessions_with_config`。远程路径会绕过已收口的 GUI 门面。

## 目标与边界

1. daemon `daemon_state.rs::list_claude_sessions` MUST 经 `EngineManager::list_claude_history_sessions`。
2. MUST NOT 直调 `claude_history::list_claude_sessions_with_config`。
3. 本刀 MUST NOT 改 daemon load / fork / delete / catalog。
4. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-daemon-list-facade-v1`
