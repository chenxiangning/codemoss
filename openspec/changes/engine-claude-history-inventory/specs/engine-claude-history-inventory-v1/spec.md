# engine-claude-history-inventory-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude history call sites MUST be inventoried before any facade

Core MUST 提供可核对的 Claude history inventory。本 change MUST NOT 修改 `engine/claude_history*` 行为。MUST NOT 删除 `engine/claude*`。

#### Scenario: inventory lists product call sites

- **WHEN** 读取 `docs/architecture/plugin-platform/inventory/claude-history.json`
- **THEN** 必须列出 GUI commands、daemon、session catalog、native continuation
- **AND** stay-in-Core 必须含其他 CLI history parser 对 Claude loader 的复用

#### Scenario: implementation files remain

- **WHEN** 检查 `src-tauri/src/engine/claude_history.rs`
- **THEN** 文件 MUST 仍存在
