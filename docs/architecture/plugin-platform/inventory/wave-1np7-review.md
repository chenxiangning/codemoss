# Wave 1NP7 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-named-pipe-connect-deadline`  
> 论文对齐：handshake 是发射；对端不出现不得卡住 Host。  
> 结论：**方向正确。这是实洞。** `named_pipe_timeout_ms` 拒绝 0 / WAIT_FOREVER。Windows connect 先 `WaitNamedPipeW`；accept 用工作线程 + `recv_timeout`。Host driver handshake 走 timed accept / connect / read / write。macOS 只验闸门与源码。不切产品。
