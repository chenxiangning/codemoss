# Proposal: plugin-ipc-handshake-hello-deadline

> Wave：1HS8（插座本体 · 接受端读 hello 也必须在 2s 内完成）  
> 依赖：1HS5 整帧截止  
> 论文对齐：handshake 是发射；沉默连接不得占用 accept。

## Why

1HS4/1HS5 只罩住 Host 读 ack。UDS / Worker 接受端仍 `read_mxpc_frame` 无限阻塞。连接后不写 hello 的对端会卡住 peer 线程。

## 边界

1. UDS / Worker 接受端读 hello MUST 走 `read_mxpc_frame_timed(..., HANDSHAKE_DEADLINE)`。
2. 连接后沉默的对端 MUST `handshake-timeout`。
3. 不切产品。

## Capabilities

- `plugin-ipc-handshake-hello-deadline-v1`
