# Wave P4.7-4 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-spawn-plan`  
> 论文对齐：Dual-run 同一时刻只有一个 active owner；生产 Command 必须可审计后才能迁 spawn。  
> 结论：**方向正确。接线已真。stream 未切，产品 owner 仍是 Core。**

## 本批做了

- `SuperviseTarget` 携带 `argv` + `cwd`；Process Entry supervise 按它们 spawn
- `spawn_plan_from_command` 从生产 `Command` 抽出可审计 plan
- `MOSSX_CLAUDE_PROCESS_ENTRY` 默认关；`send_message` 在 spawn 前过单 owner 闸门
- flag on + 合法 plan → `process-entry-spawn-not-cutover`，**不** `cmd.spawn()`
- 相对路径 / 裸 `claude` / shell / 坏 cwd → `None` / `Denied`

## 本批没做（有意）

- 不把 stdin/stdout 交给 Process Entry
- 不宣称产品 stream / interrupt conformance
- 不开 flag、不 Slim、不开市场
- 不改 `boot_driver()`

## 下一刀

P4.7-5：Process Entry 把被监督 CLI 的 stdin/stdout 接到 Host 可读的通道。在那之前 flag-on 必须继续 fail closed。
