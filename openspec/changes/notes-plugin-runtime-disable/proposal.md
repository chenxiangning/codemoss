# Proposal: notes-plugin-runtime-disable

> Wave：4G（第二根插头 · 组合面 disable）  
> 依赖：4F Host disable、2D store revoke、3G Claude 对称刀

## Why

4F 只在 Host 单测里 disable Notes fixture。组合面必须再证：activate → store/stream → disable 后三类 handle 全拒绝，且 `note_cards.rs` 仍在、未迁用户数据。

## 边界

1. 走 `PluginRuntime`，不改 command_registry。
2. disable 后 query / open_own_store / open_stream 均失败。
3. 产品 Notes 源码 MUST 仍存在。
4. 不进 boot，不 disable 产品 Claude。

## Capabilities

- `notes-plugin-runtime-disable-v1`
