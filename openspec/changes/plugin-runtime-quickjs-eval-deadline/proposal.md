# Proposal: plugin-runtime-quickjs-eval-deadline

> Wave：1QJ8（插座本体 · Worker eval 必须在 deadline 内完成）  
> 依赖：1QJ5 真实 QuickJS Runtime  
> 论文对齐：eval 是发射；死循环等于发射未完成，必须可逆切断。

## Why

1QJ5 把 eval 送进 C 引擎。allowlist 只看前缀，`mossx.handshake.hello(); while(true){}` 能过闸门后卡住 Host 线程。没有 interrupt 就没有逆操作。

## 边界

1. Worker eval MUST 在 `EVAL_DEADLINE`（2s）内完成。
2. 超时 MUST `deadline`，MUST 用 QuickJS interrupt 切断。
3. 超时后 isolate MUST 仍活着，可再 eval 合法调用。
4. Host 侧 MUST `recv_timeout`，不得无限等引擎线程。
5. 不切产品。

## Capabilities

- `plugin-runtime-quickjs-eval-deadline-v1`
