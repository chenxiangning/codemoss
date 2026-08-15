# plugin-host-generation-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST mint a monotonic generation per successful activate attempt

每次 `activate` MUST 分配比该 `pluginId` 上一次更大的 generation。旧 generation 的 control / data 调用 MUST 返回 `stale-generation` 且 MUST NOT 改变当前 slot 状态。

#### Scenario: stale generation is rejected

- **WHEN** Host 已将 plugin 激活到 generation 2
- **AND** 调用携带 generation 1
- **THEN** Host MUST 返回 `stale-generation`
