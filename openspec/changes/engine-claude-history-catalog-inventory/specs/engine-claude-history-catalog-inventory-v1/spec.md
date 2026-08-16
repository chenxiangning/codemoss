# engine-claude-history-catalog-inventory-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude catalog history call sites MUST be inventoried before any facade

Core MUST 提供可核对的 catalog history inventory。本 change MUST NOT 修改 catalog / native continuation 行为。MUST NOT 删除 `engine/claude_history*`。

#### Scenario: inventory lists catalog call sites

- **WHEN** 读取 `docs/architecture/plugin-platform/inventory/claude-history-catalog.json`
- **THEN** 必须列出 attribution list、source facts、catalog delete、native resolve

#### Scenario: implementation files remain

- **WHEN** 检查 `session_management.rs` / `native_continuation/commands.rs`
- **THEN** 这些文件 MUST 仍直调 `claude_history::*`
