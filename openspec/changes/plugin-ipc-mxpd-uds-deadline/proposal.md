# Proposal: plugin-ipc-mxpd-uds-deadline

> Wave：1MXPD1（插座本体 · MXPD UDS accept / connect / read 必须在 deadline 内完成）  
> 依赖：1UDS7 timed accept、1UDS13 timed connect、1HS5 timed read  
> 论文对齐：Data Plane 帧是发射；对端不读 / 不写不得卡住 Host。

## Why

Control Plane 的 UDS handshake 已有 2s 截止。MXPD 仍用阻塞 `accept_uds` / `connect_uds` / `read_mxpd_frame`。静默对端会卡住 Data Plane。

## 边界

1. `read_mxpd_frame_timed` MUST 在给定 deadline 内读完一帧。
2. MXPD UDS 路径 MUST 用 timed accept / connect / read。
3. header-only / 静默对端 MUST `handshake-timeout`。
4. 不切产品。

## Capabilities

- `plugin-ipc-mxpd-uds-deadline-v1`
