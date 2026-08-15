# Proposal: plugin-ipc-named-pipe-connect-deadline

> Wave：1NP7（插座本体 · Named Pipe accept / connect 必须在 handshake deadline 内完成）  
> 依赖：1NP3 Host driver、1NP6 管名隔离、1HS4 2s deadline  
> 论文对齐：handshake 是发射；对端不出现不得卡住 Host。

## Why

Windows Named Pipe handshake 现在 `ConnectNamedPipe(..., NULL)` 与 `CreateFileW` 无限等。插件不连、管不存在，Host 会挂死。UDS 已经有 timed accept / connect；Named Pipe 还没有。

## 边界

1. `connect_named_pipe_timed` MUST 在给定 deadline 内完成。Windows MUST 先 `WaitNamedPipeW`，超时 `handshake-timeout`。MUST NOT `NMPWAIT_WAIT_FOREVER`。
2. `accept_named_pipe_timed` MUST 在给定 deadline 内完成。无人连接 MUST `handshake-timeout`。
3. Host driver handshake MUST 走 timed accept / connect。
4. 非 Windows 在过完名字 / ACL 闸门后 MUST `unsupported-platform`。
5. 不切产品。macOS 验闸门与源码，不跑真实管道。

## Capabilities

- `plugin-ipc-named-pipe-connect-deadline-v1`
