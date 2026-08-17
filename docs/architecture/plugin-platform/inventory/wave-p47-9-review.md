# Wave P4.7-9 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-line-source`  
> 论文对齐：Dual-run 同一时刻只有一个 owner；行源与 spawn 必须同闸，禁止「Core spawn + 插件读」。  
> 结论：**方向正确。行源开关已真。send_message 仍 Tokio + cmd.spawn。**

## 本批做了

- `ClaudeLineSource::{Tokio, ProcessEntryNotCutover}`
- `decide_claude_line_source` 与 spawn owner 共用 `MOSSX_CLAUDE_PROCESS_ENTRY`
- `send_message` 显式过闸门后仍 `BufReader::lines()`
- flag on 不可达插件 cursor（spawn 已 fail closed）
- 6 处 `lines.next_line()` 未改

## 本批没做（有意）

- 不替换产品行读循环 / post-result grace / text-delta coalesce
- 不切 `cmd.spawn()`
- 不宣称 stream conformance
- 不开 flag、不 Slim、不开市场

## 下一刀

P4.7-10：只有在 spawn 已切到 Process Entry 之后，才允许把 6 处 `next_line` 换成 cursor。在那之前 flag-on 必须继续 fail closed。
