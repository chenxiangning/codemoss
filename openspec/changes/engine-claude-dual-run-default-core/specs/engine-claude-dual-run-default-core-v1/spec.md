# engine-claude-dual-run-default-core-v1 Spec Delta

## ADDED Requirements

### Requirement: Product Claude MUST stay Core-owned while Process Entry remains default-off

`MOSSX_CLAUDE_PROCESS_ENTRY` 与 `MOSSX_CLAUDE_COMPAT_FACADE` MUST 默认关闭。未设旗时 `decide_claude_spawn_owner` MUST 返回 `CoreCommand`，`decide_claude_line_source` MUST 返回 `Tokio`。产品 `send_message` MUST 仍包含 `cmd.spawn()`。`boot_driver()` MUST 仍 `missing_executable()`。flag 打开且 plan 合法时 MUST 返回 `ProcessEntry`；flag 打开且无 plan MUST 返回 `Denied`。本刀 MUST NOT Slim，MUST NOT 默认开 flag。

#### Scenario: flags default off keep Core spawn

- **WHEN** 环境未设置两旗
- **THEN** `claude_process_entry_enabled_from(None)` MUST 为 false
- **AND** `claude_compat_facade_enabled_from(None)` MUST 为 false
- **AND** `decide_claude_spawn_owner(false, Some(plan))` MUST 为 `CoreCommand`

#### Scenario: flag on with a legal plan selects Process Entry

- **WHEN** process-entry flag 为 true 且 plan 为合法绝对路径
- **THEN** `decide_claude_spawn_owner` MUST 为 `ProcessEntry`
- **AND** `decide_claude_line_source(true)` MUST 为 `ProcessEntry`
