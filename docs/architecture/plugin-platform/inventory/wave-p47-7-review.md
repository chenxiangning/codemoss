# Wave P4.7-7 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-stream-lines`  
> 论文对齐：产品 send_message 是增量行读 + 并行 stderr，不是批式 IO。  
> 结论：**方向正确。增量通道已真。send_message 仍 cmd.spawn。**

## 本批做了

- supervise 后 stderr 改为 pipe
- `mossx.process.stdio.read-stderr`；method 精确匹配，不再 `contains("read")`
- `SupervisedStdoutCursor::next_line`：cat 写入 `line1\n` 后、未 close 即可读到第一行
- `/bin/ls` 缺路径可读 stderr
- `engine/claude.rs` 不含 `SupervisedStdoutCursor` / `read_supervised_stderr`

## 本批没做（有意）

- 不把 `send_message` 的 `BufReader::lines()` 换成 cursor
- 不搬 first-event timeout / post-result grace / stderr 采样任务
- 不宣称 stream conformance
- 不开 flag、不 Slim、不开市场

## 下一刀

P4.7-8：把 `send_message` 的行读接到 `SupervisedStdoutCursor`。在那之前 flag-on 必须继续 fail closed。
