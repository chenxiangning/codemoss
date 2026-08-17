# Wave P4.7-8 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-stream-loop`  
> 论文对齐：产品 send_message 是循环行读 + 首事件超时 + 并行 stderr，不是单次 next_line。  
> 结论：**方向正确。读循环合同已真。send_message 仍 cmd.spawn。**

## 本批做了

- `next_line_until`：调用方可给 deadline
- `run_supervised_stream_loop`：逐行回调，并行抽 stderr
- `/bin/cat` 写入 `a\nb\n` 回调两行
- `/bin/sleep` 短 deadline → `first-event-timeout`
- `engine/claude.rs` 不含 `run_supervised_stream_loop`

## 本批没做（有意）

- 不替换产品 `BufReader::lines()` / post-result grace / text-delta coalesce
- 不宣称 stream conformance
- 不开 flag、不 Slim、不开市场
- 不改 `boot_driver()`

## 下一刀

P4.7-9：把 `send_message` 的行读接到 `run_supervised_stream_loop`。在那之前 flag-on 必须继续 fail closed。
