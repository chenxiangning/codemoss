# Wave P4.7-2 Self-Review

> 日期：2026-08-16  
> 范围：`engine-claude-process-entry-supervise`  
> 论文对齐：Process Entry 拥有 CLI transport；Host 只发封闭 MXPC，不直接 spawn 业务 CLI。  
> 结论：**方向正确。监督面已真。产品 spawn 仍在 Core。**

## 本批做了

- Process Entry 增加封闭方法 `mossx.process.supervise`
- Driver handshake 后可选发送 supervise；失败杀 leader
- `/bin/sleep` 可进组；`/bin/bash` fail closed
- interrupt 后 leader 不残留
- boot / `engine/claude.rs` 未改

## 本批没做（有意）

- 不把 `ClaudeSession::spawn` 换成 supervise
- 不开 flag、不 Slim、不开市场
- 不宣称产品 stream conformance

## 下一刀

P4.7-3：default-off 把生产 `claudeBin` 映射到 supervise。同一时刻仍只有 Core 是产品 owner。
