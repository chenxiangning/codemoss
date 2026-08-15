# Proposal: plugin-host-default-off-boot

> Wave：1H（插座闸门 · 默认 off 且不进 boot）  
> 依赖：1B HostConfig、1G PluginRuntime

## Why

组合面已存在。若启动链悄悄 `PluginRuntime::new`，产品行为会在无人确认时变化。1H 用测试锁住：默认 `enabled=false`，`lib.rs` 不构造 runtime。

## 边界

1. `HostConfig::default().enabled == false`。
2. `lib.rs` 不得出现 `PluginRuntime::new` / `Host::new`。
3. 允许 `mod plugin_runtime;`（模块编译，不进 run）。
4. 不改启动链，不 spawn。

## Capabilities

- `plugin-host-default-off-boot-v1`
