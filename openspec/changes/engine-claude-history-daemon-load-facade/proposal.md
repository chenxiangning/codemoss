# Proposal: engine-claude-history-daemon-load-facade

> OpenSpec change id: `engine-claude-history-daemon-load-facade`  
> Wave：3Z（第一根插头 · daemon history load 走默认 off 门面）  
> 依赖：`engine-claude-history-daemon-list-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3Y 把 daemon list 接到门面。daemon `load_claude_session` 仍直调 `claude_history::load_claude_session_with_config`。远程 load 会绕过已收口的 GUI 门面。

## 目标与边界

1. daemon `daemon_state.rs::load_claude_session` MUST 经 `EngineManager::load_claude_history_session`。
2. MUST NOT 直调 `claude_history::load_claude_session_with_config`。
3. 本刀 MUST NOT 改 daemon hydrate / fork / delete / catalog。
4. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-daemon-load-facade-v1`
