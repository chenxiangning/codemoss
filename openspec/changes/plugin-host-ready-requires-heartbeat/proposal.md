# Proposal: plugin-host-ready-requires-heartbeat

> Wave：1H10（插座本体 · Host Ready 必须先有一次成功 heartbeat）  
> 依赖：1H3 Ready 再激活 LIFO stop、合同 Health gate  
> 论文对齐：Ready 是对外发射；未证明健康不得发布。

## Why

合同 Health gate 要求 atomic publish 前至少一次成功 heartbeat。Host 现在 `start` 全部成功就标 Ready。handshake / spawn 成功不等于健康。假 driver 不回 heartbeat 也能进 Ready。

## 边界

1. `EntryDriver` MUST 暴露 `heartbeat`。
2. Host 在标 Ready 前 MUST 对每个已 start 的 entry 做一次 heartbeat。
3. 任一次 heartbeat 失败 MUST LIFO stop，槽位 Failed，不得 Ready。
4. 默认 driver heartbeat 成功，不切产品。

## Capabilities

- `plugin-host-ready-requires-heartbeat-v1`
