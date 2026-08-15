# Proposal: plugin-host-boot-uds-supervisor

> Wave：1H6（插座本体 · boot 后真实 UDS supervisor）  
> 依赖：1H5 CompositeDriver 默认 off、1UDS12 UnlinkOnDrop  
> 论文对齐：config is truth；supervisor socket 是获取，默认不得激活任何纤程。

## Why

合同写 Named Pipe / UDS 由 Core 创建。boot 现在只构造 `PluginRuntime<CompositeDriver>`，进程里没有控制面 listener。`UdsHandshakeDriver` 只在测试里临时 bind。这不是 supervisor。

## 边界

1. `boot_host()` MUST 在 Unix 绑定一条私有 UDS（`com.mossx.host` 目录，0600 / 父目录 0700）。
2. Host 仍 MUST `enabled=false`。activate Notes / Claude MUST `host-disabled`，MUST NOT spawn / isolate。
3. supervisor socket MUST 在 BootHost drop 时 unlink。
4. 非 Unix MUST 不绑 TCP，supervisor 为空。
5. 不切产品，不改 command_registry，不接受业务 hello。

## Capabilities

- `plugin-host-boot-uds-supervisor-v1`
