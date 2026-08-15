# Proposal: plugin-host-boot-uds-reject

> Wave：1H7（插座本体 · 默认 off 的 boot supervisor 必须拒绝意外连接）  
> 依赖：1H6 boot 绑定私有 UDS  
> 论文对齐：config is truth；supervisor socket 是获取，不得因此激活纤程。

## Why

1H6 只 `bind`，不 `accept`。连接会堆在 backlog，socket 看起来像开放通道。默认 off 的 supervisor 必须能在 handshake deadline 内收下连接并拒绝，且 MUST NOT activate Notes / Claude。

## 边界

1. Unix `BootHost::reject_unexpected` MUST `accept_uds_timed`。
2. 收到连接 MUST 回 JSON-RPC `host-disabled`，然后断开。
3. MUST NOT spawn / isolate / 改 slot。
4. 无连接 MUST `handshake-timeout`，socket 仍在。
5. 不切产品，不启动常驻 accept 循环，不改 command_registry。

## Capabilities

- `plugin-host-boot-uds-reject-v1`
