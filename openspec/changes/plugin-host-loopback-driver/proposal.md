# Proposal: plugin-host-loopback-driver

> OpenSpec change id: `plugin-host-loopback-driver`  
> Wave：1C（插排本体 · Host + codec 内存环回）  
> 依赖：`plugin-ipc-v1-framing`、`extension-host-activation-supervisor`  
> 架构：[`14` §13](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

1A 会说话，1B 会管 generation，但两边还没对过话。若直接上 UDS / QuickJS，分不清是状态机坏了还是 transport 坏了。1C 只换一个 **Loopback EntryDriver**：内存里走 MXPC handshake，证明 Host 与 framing 可组合。

## 目标与边界

1. `LoopbackDriver` 实现 `EntryDriver`：`start` 时与假对端完成 `mossx.handshake.hello` 编解码。
2. handshake 失败 → Host 回滚，slot=`failed`。
3. 成功后 `dispatch(pluginId, generation)` 仍走 1B 状态机。
4. 不 listen、不 spawn、不嵌 QuickJS、不改 App 启动链。

## 非目标

- Named Pipe / UDS / stdio
- QuickJS / Restricted Process
- Broker 业务 API
- Storage / Claude / Notes

## Capabilities

### New Capabilities

- `plugin-host-loopback-v1`：内存环回 driver 用 MXPC 完成 handshake

## 验收标准

1. 环回 hello/ack 成功后 slot=`ready`。
2. ack nonce 错误 → `handshake-rejected`，已 start 的 entry 被 stop。
3. 源码仍无 `std::net` / `Command::new`。
4. `openspec validate` 通过。
