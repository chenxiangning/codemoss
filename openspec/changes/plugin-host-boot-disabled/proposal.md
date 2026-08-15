# Proposal: plugin-host-boot-disabled

> Wave：1H1（插座本体 · Host 挂进 `lib.rs::run`，默认 off）  
> 依赖：1G 组合面、Host `enabled=false`  
> 论文对齐：配置即真相；默认配置不得激活任何纤程。

## Why

插座本体还缺 Host 进 boot。合同要求 Host 默认关闭。本刀只构造 `PluginRuntime`，不 activate Claude / Notes，不注册 command。

## 边界

1. `run()` MUST `manage` 一个 `enabled=false` 的 Host。
2. boot 构造 MUST 拒绝 Notes / Claude activate（`host-disabled`）。
3. 不得把 Host 写进 `command_registry`。
4. 不得 spawn Restricted Process / QuickJS。
5. 不得切产品 flag。

## Capabilities

- `plugin-host-boot-disabled-v1`
