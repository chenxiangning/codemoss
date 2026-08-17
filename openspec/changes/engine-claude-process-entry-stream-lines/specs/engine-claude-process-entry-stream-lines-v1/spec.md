# engine-claude-process-entry-stream-lines-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST incrementally read supervised CLI stdout lines before EOF

`SupervisedStdoutCursor::next_line` MUST 在完整行到达时立即返回该行（不含换行），MUST NOT 等到进程 EOF。未凑满一行且未 EOF MUST 继续读。EOF 后若有剩余字节 MUST 作为最后一行返回。本 API MUST NOT 被默认 `send_message` 调用。

#### Scenario: cat yields the first line before stdin is closed

- **WHEN** Process Entry 已 supervise `/bin/cat`
- **AND** Host 写入 `line1\n` 但尚未 close-stdin
- **THEN** 第一次 `next_line` MUST 返回 `line1`

### Requirement: Process Entry MUST relay supervised CLI stderr over closed MXPC

supervise 成功后 stderr MUST 为 pipe。Host MUST 只能通过 `mossx.process.stdio.read-stderr` 读它。`method` MUST 精确匹配，不得把 `read-stderr` 当成 `read`。

#### Scenario: a missing-path ls writes stderr

- **WHEN** Host supervise `/bin/ls` 并传入一个不存在的绝对路径
- **THEN** `read-stderr` 解码后 MUST 包含该失败输出
