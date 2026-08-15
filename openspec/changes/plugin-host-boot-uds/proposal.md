# Proposal: plugin-host-boot-uds

> Wave：1H2（插座本体 · boot Host 换 UDS supervisor，仍默认 off）  
> 依赖：1H1 default-off boot、1E2 UDS handshake driver  
> 论文对齐：配置即真相；默认配置不得激活任何纤程。supervisor 可以换，配置不得开。

## Why

1H1 进 boot 的是 `FakeDriver`。插座本体要求 Host 挂真实 transport supervisor。本刀只换 `UdsHandshakeDriver`，`enabled` 仍为 false。activate Notes / Claude 仍必须 `host-disabled`，不得 listen / handshake。

## 边界

1. `boot_host()` MUST 使用 `UdsHandshakeDriver`。
2. `HostConfig::enabled` MUST 仍为 false。
3. Notes / Claude activate MUST `host-disabled`，且 driver `started` 为空。
4. 不得注册 command，不得切产品 flag，不得 spawn Restricted Process。

## Capabilities

- `plugin-host-boot-uds-v1`
