# Design: windowed-transcript-load

## 契约

```
load_claude_session(workspacePath, sessionId, { limit?, before? })
→ { messages, usage?, hasMore?, nextCursor? }
```

- `limit` 省略：全量（resume/fork/测试）。
- `limit=N`：从 `before`（文件 byte offset，缺省=EOF）向更早尾读，直到 N 条可见消息或文件头。
- `nextCursor`：窗口最旧一条对应的 byte offset；`hasMore` 表示还能再向更早读。
- 默认 UI N = **80**（幕布可交互首屏；不是摘要墙）。

## 引擎顺序

1. Claude JSONL 尾读（本 change 实现）。
2. Gemini：本 change 只做 **文件体积 cap + 字段 budget**；窗口化另议。
3. Grok/Kimi 已流式 + redact，不在本 change 改契约。

## 前端

- `createClaudeHistoryLoader.load` 走窗口。
- resume/fork 仍全量 `loadClaudeSession`（无 limit）。
- reducer：`itemsByThread` 可以是窗口；`prependThreadItems` 补更早；发送/停止不得把窗口当「全历史缺失」再 assemble。
- 向上加载：显式「加载更早」按钮（`history-head`），不自动抢 stick-to-bottom。

## 失败

窗口读失败返回可读错误；**不得写回/截断**磁盘 jsonl。
