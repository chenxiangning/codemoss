# Design

`named_pipe_timeout_ms` 把 Duration 收成 `(0, u32::MAX)` 开区间，禁止 `WAIT_FOREVER`。Windows connect：`WaitNamedPipeW(name, ms)` 再 `CreateFileW`。Windows accept：工作线程跑 `ConnectNamedPipe`，主线程 `recv_timeout`；超时 drop handle 以唤醒等待。Driver handshake 改 timed accept / connect。非 Windows 只验闸门后 fail-closed。
