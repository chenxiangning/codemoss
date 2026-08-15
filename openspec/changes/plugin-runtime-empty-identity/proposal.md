# Proposal: plugin-runtime-empty-identity

> Wave：1AO（插座组装 · 空 pluginId / unit_id 不得激活）  
> 依赖：empty required entries

## Why

合同：`pluginId` 为 Reverse-DNS，Activation Unit `id` 必填。组合面已拒空 required entries，但 `plugin_id=""` / `unit_id=""` 仍能 activate，会污染 Host slot map。Storage 已拒空 pluginId。1F 后不得用空身份占槽。

## 边界

1. 空 `plugin_id` 或空 `unit_id` 的 `activate` MUST `schema`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-empty-identity-v1`
