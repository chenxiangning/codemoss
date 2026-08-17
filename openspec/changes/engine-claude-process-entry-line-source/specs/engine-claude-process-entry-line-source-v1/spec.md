# engine-claude-process-entry-line-source-v1 Spec Delta

## ADDED Requirements

### Requirement: send_message MUST keep Tokio as the only live line source

`decide_claude_line_source` MUST 在 `MOSSX_CLAUDE_PROCESS_ENTRY` 关闭时返回 `Tokio`。打开时 MUST 返回 `ProcessEntryNotCutover`，MUST NOT 让 `send_message` 改走 `SupervisedStdoutCursor`。产品路径 MUST 仍调用 `lines.next_line()`。boot MUST 不读该行源。

#### Scenario: flag off keeps the Tokio line source

- **WHEN** 环境未设置 `MOSSX_CLAUDE_PROCESS_ENTRY`
- **THEN** `decide_claude_line_source` MUST 为 `Tokio`

#### Scenario: flag on does not switch send_message onto the cursor

- **WHEN** `MOSSX_CLAUDE_PROCESS_ENTRY=1`
- **THEN** line source MUST 为 `ProcessEntryNotCutover`
- **AND** `engine/claude.rs` MUST 仍包含 `lines.next_line()`
- **AND** MUST NOT 包含 `run_supervised_stream_loop`
