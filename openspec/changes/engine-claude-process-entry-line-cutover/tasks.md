# Tasks

- [x] 1.1 落盘 proposal / design / spec delta
- [x] 1.2 `openspec validate engine-claude-process-entry-line-cutover --strict --no-interactive`
- [x] 1.3 `SupervisedStdoutCursor::poll_line` + `ProcessEntryTurn` 行读
- [x] 1.4 `send_message` flag-on 经 cursor；默认仍 Tokio
- [x] 1.5 interrupt / drop 能杀 Process Entry
- [x] 1.6 测试：cat 两行；send_message 默认 `lines.next_line`；boot 未改
