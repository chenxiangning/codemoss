# Proposal: plugin-runtime-unknown-capability

> Wave：1S（插座组装 · 组合面拒绝未知 capability）  
> 依赖：1R 只读 Broker

## Why

1R 已拒绝 write / spawn。Broker 还拒绝未知 capability。组合面尚未独立验收。1F 后 Ready 插件不得用 `mossx.filesystem.raw` 一类未授权面。

## 边界

1. Ready Notes 查询未知 capability MUST `permission-denied`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-unknown-capability-v1`
