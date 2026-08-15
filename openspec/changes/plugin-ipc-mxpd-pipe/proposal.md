# Proposal: plugin-ipc-mxpd-pipe

> OpenSpec change id: `plugin-ipc-mxpd-pipe`  
> Wave：1E4（插座余量 · Data Plane 真流，无 spawn）  
> 依赖：1A MXPD codec、1E3 framed stdio  
> 架构：[`14` §13.2 / §13.4](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

MXPC 已能过 UDS / pipe。Data Plane 仍只有纯函数 `encode_mxpd` / `can_send`。若不先在 **进程内 pipe** 上证明 open → 帧 → 窗口 → ACK/CANCEL，1F spawn 会把流控和进程生命周期缠死。

## 目标与边界

1. `DataPlane`：未 `open` 不得发 MXPD。
2. 只允许 V1 codec：`engine-event-v1` / `blob-v1` / `log-v1`。
3. 未 ACK 窗口 32 帧 / 8 MiB，超窗 `window-exceeded`。
4. `CANCEL` 后该 stream 非 ACK 帧丢弃。
5. 复用 pipe + `encode_mxpd` / `decode_mxpd`。不 spawn、不接 Host、不迁产品。

## 非目标

- Host 挂 Data Plane
- QuickJS / 子进程
- 产品 engine event 真流

## Capabilities

- `plugin-ipc-mxpd-pipe-v1`

## 验收标准

1. 未 open 发送被拒绝。
2. pipe 上 blob 帧往返成功；ACK 释放窗口。
3. 超窗 fail closed；CANCEL 后数据帧丢弃。
4. `openspec validate` 通过。
