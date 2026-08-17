# Design

```text
find_claude_code_binary
spawn_plan(-p, --tools "", stream-json, verbose, include-partial-messages)
spawn_process_entry_turn(artifact)
poll 直到 type=result
wait_until → Some(0)
缺 CLI → 跳过
```

`--tools ""` 只用于探针，缩短 turn，不改产品 argv。产品 `send_message` 仍自管循环。
