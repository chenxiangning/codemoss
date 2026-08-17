# Design

```text
decide_claude_line_source(flag)
  off → Tokio            → 现有 BufReader::lines()
  on  → ProcessEntryNotCutover → send_message 仍不切；spawn 闸门已 fail closed
```

行源与 spawn owner 共用同一 flag，避免「spawn 走 Core、读走插件」的双 owner。产品循环里的 6 处 `next_line` 本刀不动；下一刀才允许在 flag-on 且 spawn 已切之后替换它们。
