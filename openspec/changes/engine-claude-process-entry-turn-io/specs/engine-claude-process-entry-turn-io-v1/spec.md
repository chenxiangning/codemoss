# engine-claude-process-entry-turn-io-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST run a product-shaped turn IO over supervised stdio

`run_supervised_turn_io` MUST 在已 supervise 的 Process Entry 上执行：可选写入 stdin、关闭 stdin、读取 stdout 直到 `eof`。无 stdin 时 MUST 仍关闭 stdin。无 child 或中继失败 MUST 返回错误。本函数 MUST NOT 被默认 `send_message` 调用。`MOSSX_CLAUDE_PROCESS_ENTRY` MUST 默认关；打开时产品路径 MUST 仍 fail closed。

#### Scenario: echo without stdin yields its argv output

- **WHEN** Process Entry 已 supervise `/bin/echo mossx-turn`
- **AND** `run_supervised_turn_io` 的 stdin 为 `None`
- **THEN** 返回字节 MUST 包含 `mossx-turn`

#### Scenario: cat with stdin yields the written payload

- **WHEN** Process Entry 已 supervise `/bin/cat`
- **AND** stdin 为 `hello-turn`
- **THEN** 返回字节 MUST 等于 `hello-turn`
