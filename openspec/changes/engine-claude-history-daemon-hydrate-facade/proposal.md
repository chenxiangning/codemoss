# Proposal: engine-claude-history-daemon-hydrate-facade

> OpenSpec change id: `engine-claude-history-daemon-hydrate-facade`  
> Wave：3AA（第一根插头 · daemon history hydrate 走默认 off 门面）  
> 依赖：`engine-claude-history-daemon-load-facade`  
> 架构：[`06`](../../../docs/architecture/plugin-platform/06-engine-plugin-contract.md)

## Why

3Z 把 daemon load 接到门面。daemon `hydrate_claude_deferred_image` 仍直调 `claude_history::hydrate_claude_deferred_image_with_config`。远程 hydrate 会绕过已收口的 GUI 门面。

## 目标与边界

1. daemon `daemon_state.rs::hydrate_claude_deferred_image` MUST 经 `EngineManager::hydrate_claude_history_image`。
2. MUST NOT 直调 `claude_history::hydrate_claude_deferred_image_with_config`。
3. 本刀 MUST NOT 改 daemon fork / delete / catalog。
4. MUST NOT 改 history 实现、不删 `engine/claude*`、不迁 `note_cards`、不开 Marketplace、不默认开 flag。

## Capabilities

- `engine-claude-history-daemon-hydrate-facade-v1`
