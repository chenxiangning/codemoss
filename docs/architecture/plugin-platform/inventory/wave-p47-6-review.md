# Wave P4.7-6 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-turn-io`  
> 论文对齐：Dual-run 同一时刻只有一个 owner；产品 turn IO 必须先在 Process Entry 上可核对。  
> 结论：**方向正确。turn IO 合同已真。send_message 仍 cmd.spawn。**

## 本批做了

- `run_supervised_turn_io`：可选写 stdin → close → 读到 eof
- `/bin/echo mossx-turn` 无 stdin 可读
- `/bin/cat` 写入 `hello-turn` 可回环
- 无 child fail closed
- `engine/claude.rs` 不含 `run_supervised_turn_io`；flag-on 仍 `ProcessEntryNotCutover`

## 本批没做（有意）

- 不替换产品行读 / stderr 采样 / first-event timeout / post-result grace
- 不宣称 stream / interrupt conformance
- 不开 flag、不 Slim、不开市场
- 不改 `boot_driver()`

## 下一刀

P4.7-7：把 `send_message` 的行读接到 `run_supervised_turn_io`。在那之前 flag-on 必须继续 fail closed。
