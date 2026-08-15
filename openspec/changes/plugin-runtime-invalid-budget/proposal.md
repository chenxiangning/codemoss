# Proposal: plugin-runtime-invalid-budget

> Wave：1N（插座组装 · 组合面拒绝非法 HostConfig）  
> 依赖：1B Host budget、1G PluginRuntime

## Why

Host 已校验 `max_concurrent` 与 deadline。组合面 `PluginRuntime::new` 尚未独立验收非法预算。1F 后调用方若绕过 Host 直构 runtime，必须同样 fail closed。

## 边界

1. `max_concurrent > 2` MUST `invalid-budget`。
2. `activation_deadline > 30s` MUST `invalid-budget`。
3. 不进 boot，不 spawn。

## Capabilities

- `plugin-runtime-invalid-budget-v1`
