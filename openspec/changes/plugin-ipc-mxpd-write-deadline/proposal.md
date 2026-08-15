# Proposal: plugin-ipc-mxpd-write-deadline

> Wave：1MXPD2（插座本体 · MXPD 写必须在 deadline 内完成）  
> 依赖：1MXPD1 timed read、1HS10 timed write  
> 论文对齐：Data Plane 帧是发射；对端不读不得卡住 Host。

## Why

1MXPD1 只给了 accept / connect / read 截止。`DataPlane::write_frame` 仍走阻塞 `write_all`。静默读者会卡住 Data Plane。

## 边界

1. `write_mxpd_frame_timed` MUST 在给定 deadline 内写完一帧。
2. MXPD UDS 路径 MUST 用 timed write。
3. 静默读者 MUST `handshake-timeout`。
4. 不切产品。

## Capabilities

- `plugin-ipc-mxpd-write-deadline-v1`
