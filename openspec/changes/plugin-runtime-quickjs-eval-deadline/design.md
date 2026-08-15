# Design

`EngineCmd::Eval` 带 timeout。引擎线程 `set_interrupt_handler`：到期返回 true。Host `recv_timeout(timeout + slack)`。测试用 50ms 跑 `mossx.handshake.hello();while(true){}`，必须 `deadline` 且随后 `mossx.sdk.ready()` 仍成功。
