# Proposal: plugin-host-boot-composite

> Wave：1H5（插座本体 · boot Host 换 CompositeDriver，仍默认 off）  
> 依赖：1H2 UDS boot supervisor、1H4 CompositeDriver  
> 论文对齐：config 是真值；默认不得激活任何纤程。

## Why

1H2 把 boot 换成 `UdsHandshakeDriver`。1H4 之后真实纤程监督是 Process + QuickJS。boot 仍对每个 entry 做 UDS hello/ack，和 Manifest kind 不一致。

## 边界

1. `boot_host` MUST 使用 `CompositeDriver`。
2. `HostConfig::default()` MUST 仍 `enabled=false`。
3. activate Notes / Claude MUST `host-disabled`，MUST NOT spawn、MUST NOT 建 isolate。
4. process 侧 MUST 用 missing executable，禁止拿当前测试二进制当 child。
5. 不切产品，不加 `command_registry` Host 命令。

## Capabilities

- `plugin-host-boot-composite-v1`
