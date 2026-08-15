# Proposal: plugin-ipc-handshake-write-deadline

> Wave：1HS10（插座本体 · handshake 写也必须在 2s 内完成）  
> 依赖：1HS5 整帧读截止、1H8 drain  
> 论文对齐：handshake 是发射；写卡住等于发射未完成，必须卸载。

## Why

读已有 2s 截止。`write_mxpc_frame` 仍阻塞。对端 connect 后不读，boot supervisor 写 `host-disabled` 会卡在 socket buffer。这不是 fail closed。

## 边界

1. `write_mxpc_frame_timed` MUST 在给定 deadline 内写完整帧。
2. 对端不读导致缓冲满 MUST `handshake-timeout`。
3. boot `reject_one` MUST 用 timed write。
4. 不切产品。

## Capabilities

- `plugin-ipc-handshake-write-deadline-v1`
