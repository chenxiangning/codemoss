# Proposal: plugin-ipc-named-pipe-plugin-name

> Wave：1NP6（插座本体 · Named Pipe 管名必须按完整 pluginId 隔离）  
> 依赖：1NP1 管名闸门、1UDS10 完整 pluginId token  
> 论文对齐：隔离 = 独立上下文；同后缀插件不得共享发射点。

## Why

Named Pipe Host driver 现在固定 `\\.\pipe\mossx-host`。Notes 与 Claude、`com.mossx.notes` 与 `com.evil.notes` 会抢同一条管。UDS 已经按完整 pluginId 哈希分目录，Named Pipe 还没有。

## 边界

1. `private_pipe_name(plugin_id)` MUST 绑定完整 reverse-DNS pluginId。
2. 非法 pluginId MUST `schema`，不得出管名。
3. `com.mossx.notes` 与 `com.evil.notes` MUST 得到不同管名。
4. Windows handshake MUST bind 该管名，不得再用共享 `mossx-host`。
5. 不切产品。macOS 只验命名闸门。

## Capabilities

- `plugin-ipc-named-pipe-plugin-name-v1`
