# Proposal: plugin-ipc-uds-connect-parent-0700

> Wave：1UDS8（插座本体 · UDS connect 也必须要求父目录 0700）  
> 依赖：1UDS6 bind 父目录恰好 0700  
> 论文对齐：transport 是获取；connect 与 bind 必须落在同一独立上下文。

## Why

1UDS3 / 1UDS6 只闸 `bind_uds`。`connect_uds` 现在只核对端 uid。客户端仍可连 `/tmp` 或 0755 目录里的 socket。世界可写目录不是独立上下文。

## 边界

1. `connect_uds` MUST 先过 `parent_is_owner_only`。
2. `/tmp` / 0755 父目录 MUST `permission-denied`，且 MUST NOT 发起 connect。
3. 0700 私有目录里的 connect 仍 MUST 成功。
4. 不切产品。

## Capabilities

- `plugin-ipc-uds-connect-parent-0700-v1`
