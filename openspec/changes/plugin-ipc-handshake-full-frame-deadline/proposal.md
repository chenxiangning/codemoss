# Proposal: plugin-ipc-handshake-full-frame-deadline

> Wave：1HS5（插座本体 · handshake 整帧必须在 2s 内读完）  
> 依赖：1HS4 2s 截止  
> 论文对齐：handshake 是发射；半帧不是完成，超时必须卸载。

## Why

1HS4 只 `poll` 一次再 `read_exact`。对端写完 10 字节 header 后沉默，Host 仍会在 payload 上无限阻塞。合同要求的是整次 handshake 2s，不是“第一个字节 2s”。

## 边界

1. `read_mxpc_frame_timed` MUST 用同一 deadline 覆盖 header 与 payload。
2. 只回 header / 半帧的对端 MUST `handshake-timeout`。
3. spawn / UDS / Worker 读 ack 仍走 timed 读。
4. 不切产品。

## Capabilities

- `plugin-ipc-handshake-full-frame-deadline-v1`
