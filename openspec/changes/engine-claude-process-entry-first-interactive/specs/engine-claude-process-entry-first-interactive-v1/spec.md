# engine-claude-process-entry-first-interactive-v1 Spec Delta

## ADDED Requirements

### Requirement: Process Entry MUST surface a product-valid Claude first event when a real CLI exists

当本机能解析到绝对路径的 Claude Code CLI 时，制品根 `ProcessEntryTurn` MUST 用产品形 argv（`-p` + `--output-format stream-json` + `--verbose` + `--include-partial-messages`）监督该 CLI，并在 deadline 前读到 `is_product_valid_claude_stream_event` 为真的一行。读到后 MUST interrupt，进程组 MUST 不再存活。缺 CLI 或路径无法映射时 MUST 跳过，不得伪造事件。产品 `send_message` MUST 仍自管循环。flag 关闭时 MUST 仍 `cmd.spawn()`。

#### Scenario: live Claude CLI emits a valid first event through Process Entry

- **WHEN** `find_claude_code_binary` 返回可 supervise 的绝对路径
- **THEN** `poll_stdout_line` MUST 在 deadline 前返回产品形有效事件
- **AND** interrupt 后 `live_count` MUST 为 0

#### Scenario: missing CLI is skipped

- **WHEN** 本机无法解析 Claude CLI 绝对路径
- **THEN** 该验收 MUST 跳过，不得失败，也不得写入假事件
