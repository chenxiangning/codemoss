# Proposal: plugin-runtime-compose

> Wave：1G（插座组装 · 内存组合面）  
> 依赖：1B Host、1D Broker、1E5 DataPlane、2C Storage

## Why

插座零件已齐，但仍是分散模块。1F spawn / boot 前必须先有一个 **不进启动链** 的组合面：activate → query → open stream → disable/revoke。否则 boot 会把组装和生命周期缠死。

## 边界

1. `PluginRuntime` 持有 Host + Broker + DataPlane + DiskStorage。
2. 默认 Host `enabled` 由调用方注入；测试里显式 true。
3. `disable_plugin` 同时 disable Host 并 revoke DataPlane。
4. 不调用 `lib.rs::run`，不注册 command，不 spawn。

## Capabilities

- `plugin-runtime-compose-v1`
