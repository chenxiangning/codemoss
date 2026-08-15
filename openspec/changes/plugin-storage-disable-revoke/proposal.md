# Proposal: plugin-storage-disable-revoke

> Wave：2D（插座通电 · disable 撤销 store handle）  
> 依赖：1G PluginRuntime、1B2 Host disable、2C namespace 闸门

## Why

disable 已停 Host / Broker / DataPlane，但 `open_own_store` 仍只比 caller==target。合同写明 disable 必须撤销全部 handle。若不先证明 disabled 插件打不开自己的 sqlite，1F 后旧 generation 仍能读写隔离库。

## 边界

1. `PluginRuntime::open_own_store` 仅在 slot=`ready` 时成功。
2. disable 之后再开自己的 store MUST 失败，磁盘文件可保留。
3. `reset` + 再次 activate 后 MUST 能再打开同一路径。
4. 不迁 `note_cards`，不进 boot。

## Capabilities

- `plugin-storage-disable-revoke-v1`
