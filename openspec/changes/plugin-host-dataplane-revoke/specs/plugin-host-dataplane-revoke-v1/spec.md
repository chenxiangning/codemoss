# plugin-host-dataplane-revoke-v1 Spec Delta

## ADDED Requirements

### Requirement: fuse and generation switch MUST revoke Data Plane handles

每个 MXPD stream MUST 绑定 `pluginId` 与 Host `generation`。`revoke(pluginId, generation)` MUST 删除该 generation 的全部 stream。撤销后对该 stream 的非 resume 写入 MUST 失败。Host `fuse` 与 Data Plane revoke MUST 能在同一调用中组合完成。V1 MUST NOT 跨 generation resume。

#### Scenario: revoked generation cannot write

- **WHEN** stream 已按 generation 1 open
- **AND** 调用 `revoke(pluginId, 1)`
- **THEN** 再写 MUST 失败

#### Scenario: fuse_and_revoke fuses the slot and drops streams

- **WHEN** Host 已激活 plugin 且 DataPlane 已 open
- **AND** 调用 `fuse_and_revoke`
- **THEN** slot state MUST 为 `fused`
- **AND** DataPlane MUST 不再持有该 generation 的 codec
