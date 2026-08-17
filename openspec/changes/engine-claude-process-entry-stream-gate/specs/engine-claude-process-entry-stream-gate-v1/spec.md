# engine-claude-process-entry-stream-gate-v1 Spec Delta

## ADDED Requirements

### Requirement: Process Entry MUST honor product first-event and interrupt on the artifact root

制品根上的 `ProcessEntryTurn` MUST 能在 CLI 产出首行时于 EOF 前读到该行。沉默 CLI MUST 在 first-event deadline 后被 interrupt，且进程组 MUST 不再存活。产品 `send_message` MUST 仍自管循环，MUST NOT 调用 `run_supervised_stream_loop`。flag 关闭时 MUST 仍 `cmd.spawn()`。

#### Scenario: echo yields a line before eof

- **WHEN** 制品根 supervise `/bin/echo first-event`
- **THEN** `poll_stdout_line` MUST 在 deadline 前返回该行
- **AND** 该行 MUST 出现在 EOF 之前

#### Scenario: silent sleep is interrupted after deadline

- **WHEN** 制品根 supervise `/bin/sleep 30` 且 first-event deadline 已过
- **THEN** interrupt MUST 使 `live_count` 为 0
- **AND** 旧 child pid MUST 不再存活
