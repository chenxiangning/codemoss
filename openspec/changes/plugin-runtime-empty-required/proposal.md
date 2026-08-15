# Proposal: plugin-runtime-empty-required

> Wave：1O（插座组装 · 组合面空 required_entries 失败）  
> 依赖：1B Host activate、1G PluginRuntime

## Why

Host 已拒绝空 required closure。组合面尚未独立验收。1F 后空 entry 的 activate 不能被当成成功。

## 边界

1. `required_entries` 为空 MUST `schema`。
2. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-empty-required-v1`
