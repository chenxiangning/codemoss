# Design

```text
echo 首行
  spawn_process_entry_turn(artifact, /bin/echo)
  poll_stdout_line 直到 Line 或 deadline
  必须先于 EOF 拿到非空行

sleep 沉默
  spawn_process_entry_turn(artifact, /bin/sleep)
  poll 直到 deadline
  interrupt
  live_count == 0 且旧 pid 不在
```

产品 `send_message` 继续用 `next_claude_line` + `fail_stream_no_event_timeout`。本刀只把同一合同钉在制品根上。
