# Proposal: plugin-broker-readonly-v1

> OpenSpec change id: `plugin-broker-readonly-v1`  
> Wave：1D（插排本体 · Broker 只读 stub）  
> 依赖：`extension-host-activation-supervisor`  
> 架构：[`08` P1.4](../../../docs/architecture/plugin-platform/08-migration-roadmap-and-tasks.md)、[`14` §9](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

Host 已经能激活假插件，但插件还没有合法的能力出口。若先上真实 workspace FS / git / network，Broker 会和产品路径缠死。1D 只做 **只读 stub**：当前 workspace 路径来自 fixture，写操作 fail closed。

## 目标与边界

1. `CapabilityBroker` 仅允许 `mossx.workspace.read` 的只读查询。
2. 查询必须带当前 `pluginId + generation`；stale generation fail closed。
3. `mossx.workspace.write` / `mossx.process.spawn` / 未知 capability：`permission-denied`。
4. 不读真实磁盘、不改用户工作区、不接 AppShell。

## 非目标

- 真实 path glob / git / network
- QuickJS 绑定
- Storage namespace
- UDS transport

## Capabilities

### New Capabilities

- `plugin-broker-readonly-v1`：generation-scoped 只读 workspace stub

## 验收标准

1. ready slot + 当前 generation 可读到 fixture workspace path。
2. stale generation / fused / 未激活：拒绝。
3. write / spawn / 未知 id：`permission-denied`。
4. 源码无 `std::fs` 读用户路径。
5. `openspec validate` 通过。
