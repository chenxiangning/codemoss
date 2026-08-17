# notes-product-default-isolated-v1 Spec Delta

## ADDED Requirements

### Requirement: Product Notes MUST use isolated sqlite unless explicitly disabled

未设置 `MOSSX_NOTES_COMPAT_FACADE` 时 MUST 视为启用。七条 `note_card_*` MUST 经 `isolated_product()` 读写隔离 namespace。显式 `0` / `false` MUST 走 `note_card_*_core`。源 json MUST 保留。本刀 MUST NOT Slim。

#### Scenario: unset env selects isolated sqlite

- **WHEN** 环境未设置该变量
- **THEN** `notes_compat_facade_enabled_from(None)` MUST 为 true

#### Scenario: explicit off keeps Core files

- **WHEN** 变量为 `0`
- **THEN** `notes_compat_facade_enabled_from` MUST 为 false
- **AND** `command_registry` MUST 仍绑 `crate::note_cards`
