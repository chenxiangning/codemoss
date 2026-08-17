# Wave P4.7-10 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-turn-handle`  
> 论文对齐：Dual-run 同一时刻只有一个 owner。flag-on 必须真 spawn Process Entry，不得再 `cmd.spawn()`；行读未切则必须杀组，禁止 Core 读一个它没 spawn 的 Child。  
> 结论：**方向正确。flag-on spawn 已真。默认仍 cmd.spawn。行读未切。**

## 本批做了

- `ProcessEntryTurn`：Host activate + supervise，stdin / close / interrupt
- `spawn_process_entry_turn`：合法 plan + 可解析 Process Entry 才拉起
- `send_message` flag-on：走 Process Entry，不再 `cmd.spawn()`
- 行源仍不是 cursor 时立刻 interrupt，返回 `process-entry-lines-not-cutover`
- `/bin/sleep` 真 spawn 后杀组，leader 不泄漏

## 本批没做（有意）

- 不替换 6 处 `lines.next_line()` / post-result grace / text-delta coalesce
- 不宣称 stream conformance
- 不开 flag、不 Slim、不开市场
- 不改 `boot_driver()`
- 过渡仓 `packages/plugin-engine-claude` 仍无预编译 Process Entry；产品 flag-on 若缺文件会 `activation-failed`（fail closed）

## 下一刀

P4.7-11：把 6 处 `next_line` 接到 `SupervisedStdoutCursor`。在那之前 flag-on 成功 spawn 后仍必须因行读未切而杀组。
