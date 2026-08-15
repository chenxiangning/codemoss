# Proposal: plugin-ipc-handshake-deadline

> Wave：1HS4（插座本体 · handshake 必须在 2s 内完成）  
> 依赖：1HS3 hello generation  
> 论文对齐：handshake 是发射；超时必须卸载，不得一直堵。

## Why

合同写明对端必须在 2s 内回 ack。`read_mxpc_frame` 现在无限阻塞。沉默对端会卡住 Host 激活。

## 边界

1. `HANDSHAKE_DEADLINE` MUST 为 2s。
2. `handshake_deadline_ok(elapsed)` 在 `elapsed > 2s` 时 MUST `handshake-timeout`。
3. handshake 读帧 MUST 带读超时；超时 MUST 不得留下 child / isolate。
4. 沉默对端 MUST 不得完成 handshake。
5. 不切产品。

## Capabilities

- `plugin-ipc-handshake-deadline-v1`
