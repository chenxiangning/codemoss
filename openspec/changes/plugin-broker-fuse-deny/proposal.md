# Proposal: plugin-broker-fuse-deny

> Wave：1D2（插座余量 · fuse 后 Broker 拒绝）  
> 依赖：1D 只读 Broker、1B Host fuse、1E5 revoke

## Why

1D 只证明 ready 可读、坏 generation 拒绝。合同写明 fused / disabled 插件不得持有 workspace handle。若不先证明 fuse 后 query 失败，1F 后旧 generation 仍能读 fixture。

## 边界

1. `query` 在 slot=`fused` 时 MUST 失败。
2. 失败后不得返回 `workspace_root`。
3. 不开放 write/spawn，不读真实 FS，不进 boot。

## Capabilities

- `plugin-broker-fuse-deny-v1`
