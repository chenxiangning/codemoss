# engine-claude-product-default-process-entry-v1 Spec Delta

## ADDED Requirements

### Requirement: Product Claude MUST use Process Entry unless explicitly disabled

未设置 `MOSSX_CLAUDE_PROCESS_ENTRY` 时 MUST 视为启用。`decide_claude_spawn_owner(true, Some(plan))` MUST 为 `ProcessEntry`。显式 `0` / `false` MUST 关闭并走 `CoreCommand`。缺 plan MUST `Denied`。`boot_driver()` MUST 仍 `missing_executable()`。本刀 MUST NOT Slim。

#### Scenario: unset env selects Process Entry

- **WHEN** 环境未设置该变量
- **THEN** `claude_process_entry_enabled_from(None)` MUST 为 true
- **AND** `decide_claude_line_source(true)` MUST 为 `ProcessEntry`

#### Scenario: explicit off keeps Core spawn

- **WHEN** 变量为 `0`
- **THEN** `claude_process_entry_enabled_from` MUST 为 false
- **AND** 产品源码 MUST 仍含 `cmd.spawn()` 作为回退
