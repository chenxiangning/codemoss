# Design

```text
supervise(CLI)
  stderr = pipe（与 stdout 同）
  mossx.process.stdio.read-stderr  → dataHex + eof

Host SupervisedStdoutCursor
  pending bytes
  next_line() = 从 pending 切一行；不够则 read stdout；eof 时冲剩余
```

行切分在 Host，因为产品合同是 `BufReader.lines()`，不是 MXPD `engine-event-v1`。Process Entry 仍只中继字节。`method` 用精确 JSON 字段匹配，避免 `read` 误吃 `read-stderr`。

`send_message` 仍不调用这些 API。flag-on 仍 `process-entry-spawn-not-cutover`。
