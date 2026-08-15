# Proposal: plugin-runtime-fuse-isolation

> Wave：1AK（插座组装 · fuse 一个插头不得撤另一个插头的 stream）  
> 依赖：1I disable Notes 保留 Claude stream、1AF 跨插件 stream_id

## Why

1I 已锁 disable Notes 保留 Claude stream。fuse 走同一 `revoke(plugin_id, generation)`，组合面尚未独立验收反向：fuse Claude 不得撤 Notes stream。1F 后熔断一个引擎不得把另一个插件的 DataPlane 一并掐掉。

## 边界

1. 双插头都 Ready 并各开一条 stream 后，`fuse_plugin(claude)` MUST 只撤 Claude stream。
2. Notes query / stream / store MUST 仍可用。
3. 不进 boot，不 spawn，不迁 `note_cards`。

## Capabilities

- `plugin-runtime-fuse-isolation-v1`
