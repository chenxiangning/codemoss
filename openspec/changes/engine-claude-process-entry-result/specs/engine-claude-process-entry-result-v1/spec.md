# engine-claude-process-entry-result-v1 Spec Delta

## ADDED Requirements

### Requirement: Process Entry MUST reap a real Claude print turn through result and exit status

当本机能解析到绝对路径的 Claude Code CLI 时，制品根 `ProcessEntryTurn` MUST 监督一条短 print turn，并在 deadline 前读到 `type=result` 的 stream-json 行。随后 MUST `wait_until` 收到退出码。成功 turn 的 code MUST 为 0。缺 CLI 或路径无法映射时 MUST 跳过，不得伪造 `result`。产品 `send_message` MUST 仍自管循环。flag 关闭时 MUST 仍 `cmd.spawn()`。

#### Scenario: live Claude CLI emits result then exits zero

- **WHEN** `find_claude_code_binary` 返回可 supervise 的绝对路径
- **THEN** `poll_stdout_line` MUST 在 deadline 前返回 `type=result`
- **AND** `wait_until` MUST 返回 `Some(0)`

#### Scenario: missing CLI is skipped

- **WHEN** 本机无法解析 Claude CLI 绝对路径
- **THEN** 该验收 MUST 跳过，不得失败，也不得写入假 result
