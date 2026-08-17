# Wave P4.7-12 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-resume-gate`  
> 论文对齐：Dual-run 同一时刻只有一个 owner。flag-on 中途 resume 不得再 `cmd.spawn()` 第二条 Core Child。  
> 结论：**方向正确。闸已真。resume 语义未切。默认仍 Core spawn。**

## 本批做了

- `process_entry_resume_not_cutover`
- `refuse_process_entry_resume`：flag on 杀 Process Entry generation
- approval / AskUser 两条 resume 在 `cmd.spawn()` 前过闸
- 默认路径仍两处 `cmd.spawn()`

## 本批没做（有意）

- 不把 resume 再走 `spawn_process_entry_turn`
- 不宣称 resume / stream conformance
- 不开 flag、不 Slim、不改 `boot_driver()`

## 下一刀

P4.7-13：approval / AskUser resume 经 Process Entry 再 spawn。在那之前 flag-on resume 必须继续 fail closed。
