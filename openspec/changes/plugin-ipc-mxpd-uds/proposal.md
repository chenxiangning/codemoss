# Proposal: plugin-ipc-mxpd-uds

> Wave：1E6（插座余量 · MXPD 过 UDS）  
> 依赖：1E UDS 成帧、1E4/1E5 DataPlane

## Why

MXPD 只在 pipe 上证明过。合同里 Worker 走 UDS。若不先在注入短路径上证明 DataPlane open → 写帧 → revoke，1F spawn 会把 socket 与流控缠死。

## 边界

1. 复用 `bind_uds` + `read_mxpd_frame` / `write_mxpd_frame`。
2. 线程对端，不 `Command::spawn`。
3. generation revoke 后不能再写。
4. 不接 Host boot，不迁 Notes，不 disable Claude。

## Capabilities

- `plugin-ipc-mxpd-uds-v1`
