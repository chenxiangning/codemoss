# Design

```text
find_claude_code_binary → 绝对路径
spawn_plan_from_command(-p, stream-json, --verbose, --include-partial-messages)
spawn_process_entry_turn(artifact_root, plan)
poll_stdout_line 直到 is_product_valid_claude_stream_event
interrupt → live_count == 0

缺 CLI / 相对路径 / 映射失败 → 跳过
```

产品 `send_message` 仍自管循环。本刀只把 first-interactive 钉在 Process Entry 上。
