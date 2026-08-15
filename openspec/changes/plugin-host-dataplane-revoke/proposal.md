# Proposal: plugin-host-dataplane-revoke

> OpenSpec change id: `plugin-host-dataplane-revoke`  
> Wave：1E5（插座余量 · fuse 撤销 Data Plane）  
> 依赖：1B Host、1E4 MXPD pipe  
> 架构：[`14` §13.4](../../../docs/architecture/plugin-platform/14-v1-contract-freeze.md)

## Why

1E4 能在 pipe 上发 MXPD，但 stream 没有 generation 绑定。合同写明：fuse / disable / generation 切换必须撤销全部 handle，且不得 resume。若不先证明这一闸门，1F spawn 后旧 generation 的数据帧会漏进新槽。

## 目标与边界

1. `DataPlane::open` 绑定 `plugin_id` + `generation`。
2. `revoke(plugin_id, generation)` 删除该 generation 的全部 stream。
3. 撤销后再写 → `revoked` / `not-open`，pipe 不再增加数据帧。
4. 提供 `fuse_and_revoke`：Host `fuse` 后立刻 revoke 同 plugin 当前 generation。
5. 不 spawn、不进 boot、不迁 Notes、不 disable Claude。

## 非目标

- 把 DataPlane 嵌进 `Host<D>` 泛型（避免打爆既有 Host 单测）
- 跨进程 resume
- 产品 engine event 真流

## Capabilities

- `plugin-host-dataplane-revoke-v1`

## 验收标准

1. 绑定 generation 的 stream 在 revoke 后不能再写。
2. `fuse_and_revoke` 后 Host slot=`fused` 且 DataPlane 无该 generation 的 codec。
3. `openspec validate` 通过。
