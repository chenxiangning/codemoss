# Wave 1NP1 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-named-pipe`  
> 结论：**方向正确。Named Pipe 名字闸门全平台生效；非 Windows fail-closed，不绑 TCP。** Windows hello/ack 已写进 `cfg(windows)` 测试，本机 macOS 不能跑通那两条。不进 boot，无产品切流。
