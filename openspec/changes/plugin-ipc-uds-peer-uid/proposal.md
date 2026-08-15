# Proposal: plugin-ipc-uds-peer-uid

> Wave：1UDS4（插座本体 · UDS accept/connect 必须核验对端 uid）  
> 依赖：1UDS3 0700 私有目录  
> 论文对齐：隔离 = 独立上下文；未授权主体不得获取 transport。

## Why

1UDS3 只保证路径落在 0700 目录、socket 0600。`accept` / `connect` 之后没有 peer credential。合同写的是当前用户 + Host 创建。路径权限被绕过时，外用户仍能完成 handshake。

## 边界

1. `uds_peer_ok(peer_uid)` MUST 要求 `peer_uid ==` 当前用户。
2. `accept_uds` / `connect_uds` MUST 在读写 MXPC 之前调用 peer 校验。
3. 外用户 uid MUST `permission-denied`，且不得进入 handshake。
4. UDS driver / MXPD UDS 测试 MUST 走这两条入口。
5. 不切产品。不要求 peer pid 等于 Host（Restricted Process 是另一 pid）。

## Capabilities

- `plugin-ipc-uds-peer-uid-v1`
