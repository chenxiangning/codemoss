# engine-claude-history-catalog-source-facts-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: catalog Claude source facts MUST go through the default-off facade

`session_management_catalog_projection.rs` MUST 经 `EngineManager` 的 related / workspace-only source-facts 入口。flag on MUST 走门面。flag off MUST 走同一份 `claude_history::*` 实现。MUST NOT 删除 `engine/claude_history*`。本刀 MUST NOT 改 catalog delete / native resolve。

#### Scenario: catalog source facts use the manager entries

- **WHEN** 检查 `session_management_catalog_projection.rs`
- **THEN** related / workspace-only 分支 MUST 调用 manager 入口
- **AND** MUST NOT 直调 `claude_history::list_*source_facts*`

#### Scenario: flag stays off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** catalog source facts MUST 仍读同一份磁盘 JSONL 实现
