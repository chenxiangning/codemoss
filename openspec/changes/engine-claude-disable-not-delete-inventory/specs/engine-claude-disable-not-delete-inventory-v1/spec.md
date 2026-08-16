# engine-claude-disable-not-delete-inventory-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude disable-not-delete evidence MUST be inventoried before any product disable

Core MUST 提供可核对的 disable-not-delete inventory。本 change MUST NOT 修改产品启动链。MUST NOT 删除 `engine/claude*`。MUST NOT 默认打开 `MOSSX_CLAUDE_COMPAT_FACADE`。

#### Scenario: inventory separates fixture disable from product owner

- **WHEN** 读取 `docs/architecture/plugin-platform/inventory/claude-disable-not-delete.json`
- **THEN** 必须标明 Host fixture 已能 disable
- **AND** 必须标明产品 Claude 仍是唯一 runtime owner
- **AND** 必须标明 `engine/claude.rs` 仍存在

#### Scenario: boot does not product-disable Claude

- **WHEN** 检查 `src-tauri/src/plugin_runtime/boot.rs`
- **THEN** MUST NOT 调用 `disable("com.mossx.engine.claude")`
