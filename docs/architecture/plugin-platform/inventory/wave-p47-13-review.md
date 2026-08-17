# Wave P4.7-13 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-resume-spawn`  
> 论文对齐：Dual-run 同一时刻只有一个 owner。flag-on resume 必须再走 Process Entry，不得 `cmd.spawn()` 第二条 Core Child。  
> 结论：**方向正确。flag-on resume 已真切。默认仍 Core spawn。不称 conformance。**

## 本批做了

- `try_resume_process_entry_turn`：杀旧 generation，再 `spawn_process_entry_turn`
- approval / AskUser 两条 resume 在 flag-on 走 PE，`Ok(None)` 让循环继续 `next_claude_line`
- stream-json 答案写入 PE stdin
- `/bin/sleep` 换 generation，旧 pid 不泄漏
- 默认路径仍两处 `cmd.spawn()`

## 本批没做（有意）

- 不宣称 resume / stream / interrupt conformance
- 不开 flag、不 Slim、不改 `boot_driver()`
- 过渡仓仍无预编译 Process Entry；产品 flag-on 缺文件 fail closed

## 下一刀

P4.7-14：产品 exit-status / first-event / interrupt 与 Process Entry 收割对齐。在那之前不称 conformance。
