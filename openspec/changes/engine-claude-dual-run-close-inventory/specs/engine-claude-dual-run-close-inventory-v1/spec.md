# engine-claude-dual-run-close-inventory-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude dual-run close state MUST be inventoried before any product disable

Core MUST 提供可核对的 dual-run close inventory。本 change MUST NOT 修改产品行为。MUST NOT 删除 `engine/claude*`。MUST NOT 默认打开 `MOSSX_CLAUDE_COMPAT_FACADE`。

#### Scenario: inventory lists completed dual-run evidence

- **WHEN** 读取 `docs/architecture/plugin-platform/inventory/claude-dual-run-close.json`
- **THEN** 必须标明 adapter / 默认 off / 产品 history 门面 / 过渡仓 / fixture disable 已齐
- **AND** 必须标明产品 disable / slim / Marketplace 仍禁止

#### Scenario: product defaults stay off

- **WHEN** 未设置 `MOSSX_CLAUDE_COMPAT_FACADE`
- **THEN** 门面 MUST 仍默认关闭
- **AND** `engine/claude.rs` MUST 仍存在
