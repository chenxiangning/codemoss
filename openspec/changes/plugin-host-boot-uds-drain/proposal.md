# Proposal: plugin-host-boot-uds-drain

> Wave：1H8（插座本体 · 默认 off 的 boot supervisor 必须抽干意外连接）  
> 依赖：1H7 单条 reject  
> 论文对齐：config is truth；backlog 里的获取也不得激活纤程。

## Why

1H7 `reject_unexpected` 只 accept 一条。两条客户端同时连上时，第二条留在 backlog。默认 off 的 supervisor MUST 抽干已排队的连接，每条回 `host-disabled`。

## 边界

1. Unix `BootHost::drain_unexpected` MUST 抽干 backlog。
2. 每条连接 MUST 回 `host-disabled` 并断开。
3. MUST NOT spawn / isolate / 改 slot。
4. 无连接 MUST `handshake-timeout`。
5. 不切产品，不启动常驻 accept 循环。

## Capabilities

- `plugin-host-boot-uds-drain-v1`
