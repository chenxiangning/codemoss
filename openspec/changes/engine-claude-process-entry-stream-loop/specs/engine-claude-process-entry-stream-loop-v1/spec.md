# engine-claude-process-entry-stream-loop-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST run a product-shaped stdout line loop over the cursor

`run_supervised_stream_loop` MUST 用 `SupervisedStdoutCursor` 逐行读取。首行必须在调用方给出的 deadline 内到达，否则 MUST 返回 `first-event-timeout`。循环期间 MUST 抽 stderr。本函数 MUST NOT 被默认 `send_message` 调用。`MOSSX_CLAUDE_PROCESS_ENTRY` MUST 默认关。

#### Scenario: cat yields both lines and empty stderr

- **WHEN** Process Entry 已 supervise `/bin/cat` 并写入 `a\nb\n` 后 close-stdin
- **THEN** loop MUST 依次回调 `a`、`b` 并在 EOF 结束

#### Scenario: a silent sleep times out before the first line

- **WHEN** Process Entry 已 supervise `/bin/sleep` 且 deadline 远短于 sleep
- **THEN** loop MUST 返回 `first-event-timeout`
