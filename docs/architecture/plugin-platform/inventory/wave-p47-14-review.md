# Wave P4.7-14 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-wait`  
> 论文对齐：产品 send_message 在 EOF 后 wait，非零退出当失败。一律 interrupt 会把自然失败吃成成功。  
> 结论：**方向正确。flag-on 能收割 CLI 退出码。默认仍 child.wait。不称 conformance。**

## 本批做了

- Process Entry `mossx.process.wait`（非阻塞 try_wait）
- `ProcessEntryTurn::try_wait` / `wait_until`
- `send_message` 非 grace：先 wait；未退出才 interrupt
- 非零 code 走 TurnError
- `/bin/true` → 0；`/bin/false` → 1

## 本批没做（有意）

- 不宣称 stream / interrupt / storage / rollback conformance
- 不开 flag、不 Slim、不改 `boot_driver()`
- 过渡仓仍无预编译 Process Entry

## 下一刀

P4.7-15：产品 first-interactive / stream 事件 conformance，或 Notes。在那之前不称插头完成。
