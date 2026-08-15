# Proposal: plugin-runtime-read-only-broker

> Wave：1R（插座组装 · 组合面拒绝 write / spawn）  
> 依赖：1C Broker 只读、1G PluginRuntime

## Why

Broker 已拒绝 `mossx.workspace.write` 与 `mossx.process.spawn`。组合面只有 `query_read`，1F 后调用方可能绕过 runtime 直调 Broker。本刀把 capability query 升到组合面并锁住写/spawn。

## 边界

1. `query` 暴露 capability 查询。
2. Ready Notes 的 write / spawn MUST `permission-denied`。
3. Ready Notes 的 read MUST 成功。
4. 不进 boot，不 spawn 真进程。

## Capabilities

- `plugin-runtime-read-only-broker-v1`
