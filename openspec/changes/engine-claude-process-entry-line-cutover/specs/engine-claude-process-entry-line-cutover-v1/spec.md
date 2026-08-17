# engine-claude-process-entry-line-cutover-v1 Spec Delta

## ADDED Requirements

### Requirement: Flag-on send_message MUST read stdout through the supervised cursor

`decide_claude_line_source` MUST 在 flag 打开时返回 `ProcessEntry`。`send_message` MUST 用 `SupervisedStdoutCursor::poll_line` 读行，MUST NOT 在成功 spawn 后因行源未切而杀组。默认 flag 关闭时 MUST 仍调用 `lines.next_line()`。

#### Scenario: cat lines are visible through the turn handle

- **WHEN** Process Entry 已 supervise `/bin/cat` 并写入 `a\nb\n` 后 close-stdin
- **THEN** `poll_line` MUST 依次得到 `a`、`b`

#### Scenario: default send_message still uses Tokio lines

- **WHEN** 环境未设置 `MOSSX_CLAUDE_PROCESS_ENTRY`
- **THEN** `engine/claude.rs` MUST 仍包含 `cmd.spawn()` 与 `lines.next_line()`
- **AND** `boot_driver()` MUST 仍为 `missing_executable()`
