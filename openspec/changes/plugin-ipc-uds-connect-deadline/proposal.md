# Proposal: plugin-ipc-uds-connect-deadline

> Wave：1UDS13（插座本体 · UDS connect 必须在 handshake deadline 内完成）  
> 依赖：1UDS7 timed accept、1HS4 2s 截止  
> 论文对齐：handshake 是发射；connect 卡住等于发射未完成。

## Why

accept / 读 / 写都有 2s 截止。`connect_uds` 仍阻塞。socket 文件在、listener 不 accept 时，Unix connect 会一直等。Worker / UDS driver 激活会被卡住。

## 边界

1. `connect_uds_timed` MUST 在给定 deadline 内完成。
2. listener 不 accept MUST `handshake-timeout`。
3. UDS driver / Worker handshake MUST 用 timed connect。
4. `/tmp` / 0755 父目录仍 MUST 先 `permission-denied`，不得发起 connect。
5. 不切产品。

## Capabilities

- `plugin-ipc-uds-connect-deadline-v1`
