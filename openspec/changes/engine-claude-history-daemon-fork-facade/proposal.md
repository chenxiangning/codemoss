# Proposal: engine-claude-history-daemon-fork-facade

> OpenSpec change id: `engine-claude-history-daemon-fork-facade`  
> Wave：3AB（第一根插头 · daemon history fork 走默认 off 门面）  
> 依赖：`engine-claude-history-daemon-hydrate-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3AA 把 daemon hydrate 接到门面。daemon `fork_claude_session` 仍直调 `claude_history::fork_claude_session_with_config`。远程 fork 会绕过已收口的 GUI 门面。

## 目标与边界

1. daemon `daemon_state.rs::fork_claude_session` MUST 经 `EngineManager::fork_claude_history_session`。
2. MUST NOT 直调 `claude_history::fork_claude_session_with_config`。
3. 本刀 MUST NOT 改 daemon `from_message` / delete / catalog。
4. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-daemon-fork-facade-v1`
