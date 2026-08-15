# Proposal: plugin-runtime-fuse

> Wave：1J（插座组装 · fuse 组合面）  
> 依赖：1E5 fuse_and_revoke、1G PluginRuntime、2D store revoke

## Why

disable 已在组合面撤销三类 handle。fuse 是另一条不可恢复路径（reset 前不得再 activate）。组合面必须暴露 `fuse_plugin`，否则 1F 后只有 disable 能撤 handle。

## 边界

1. `PluginRuntime::fuse_plugin` 调 `fuse_and_revoke`。
2. fuse 后 query / open_own_store / open_stream MUST 失败。
3. 再次 activate MUST 返回 `fused`，直到 reset。
4. 不进 boot，不删产品代码。

## Capabilities

- `plugin-runtime-fuse-v1`
