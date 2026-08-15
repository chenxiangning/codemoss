# Proposal: plugin-ipc-uds-private-dir

> Wave：1UDS3（插座本体 · UDS 必须落在 0700 私有目录）  
> 依赖：1UDS2 socket 0600  
> 论文对齐：transport 是获取；世界可写目录不是允许的获取点。

## Why

1UDS2 把 socket 设成 0600。socket 仍直接落在 `/tmp`（1777）。其他用户可以抢同名路径或做 symlink 替换。合同要求 endpoint ownership。

## 边界

1. `bind_uds` MUST 拒绝父目录为 `/tmp` 或 world-writable。
2. 公开 helper MUST 先建 owner-only `0700` 目录，再在其中 bind。
3. socket 本身仍 MUST 为 `0600`。
4. 不切产品。

## Capabilities

- `plugin-ipc-uds-private-dir-v1`
