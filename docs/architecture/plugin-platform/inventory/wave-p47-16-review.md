# Wave P4.7-16 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-stream-gate`  
> 论文对齐：产品 send_message 在首事件前有 deadline；超时必须杀进程组。隔离 stream_loop 测试不够，必须钉在制品根 ProcessEntryTurn 上。  
> 结论：**方向正确。制品根能读首行，沉默能杀组。不称 Claude CLI stream conformance。**

## 本批做了

- 制品根 `/bin/echo first-event`：EOF 前读到该行
- 制品根 `/bin/sleep 30`：deadline 后 interrupt，live_count=0，旧 pid 不在
- 产品源仍自管 `fail_stream_no_event_timeout` + `poll_stdout_line`，不含 `run_supervised_stream_loop`
- 默认仍 `cmd.spawn()`，boot 仍 `missing_executable()`

## 本批没做（有意）

- 不跑真实 Claude CLI
- 不宣称 stream / storage / rollback conformance
- 不开 flag、不 Slim、不改 `boot_driver()`
- 不做 Notes

## 下一刀

P4.7-17：真实 Claude CLI first-interactive / stream conformance，或 Notes。在那之前不称插头完成。
