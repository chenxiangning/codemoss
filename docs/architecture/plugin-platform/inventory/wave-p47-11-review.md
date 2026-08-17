# Wave P4.7-11 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-line-cutover`  
> 论文对齐：Dual-run 同一时刻只有一个 owner。flag-on spawn 已真，行读必须走 cursor，不得再立刻杀组。  
> 结论：**方向正确。flag-on 行读已接到 cursor。默认仍 cmd.spawn + Tokio。不称 conformance。**

## 本批做了

- `LinePoll` + `SupervisedStdoutCursor::poll_line`（非阻塞）
- `ProcessEntryTurn::poll_stdout_line` / `take_stderr`
- `send_message` 5 处 stdout 读经 `next_claude_line`
- flag-on 不再 `process-entry-lines-not-cutover`
- interrupt / drop / first-event timeout 能杀 Process Entry generation
- `/bin/cat` 写入 `a\nb\n` 经 handle 读到两行

## 本批没做（有意）

- 不默认开 flag、不 Slim、不改 `boot_driver()`
- 不宣称 stream / interrupt / exit-status conformance
- approval / AskUser resume 仍返回 Core `Lines<ChildStdout>`（Process Entry 路径未切这条 resume）
- 过渡仓仍无预编译 Process Entry；产品 flag-on 缺文件 fail closed

## 下一刀

P4.7-12：approval / AskUser resume 不得再 `cmd.spawn()` 第二条 Core Child。在那之前 flag-on 中途 resume 必须 fail closed。
