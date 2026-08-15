# Proposal: plugin-runtime-catalog-denied

> Wave：1BL（插座组装 · 剩余 V1 catalog 一律拒绝）  
> 依赖：1AE / 1BB / 1BF 已拒 provider / notifications / search

## Why

V1 Broker 只开放 `mossx.workspace.read`。catalog 里剩余的 context / command / tool / UI / settings / status 尚未在组合面批量验收。1F 后不得漏放任一 catalog 能力。

## 边界

1. Ready Notes query 剩余 catalog 能力 MUST `permission-denied`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-catalog-denied-v1`
