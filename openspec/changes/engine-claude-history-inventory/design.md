# Design

只写 inventory。不接门面。history 是磁盘 JSONL，不是 `ClaudeSessionManager` 内存表。下一刀才是默认 off 的 history 门面。
