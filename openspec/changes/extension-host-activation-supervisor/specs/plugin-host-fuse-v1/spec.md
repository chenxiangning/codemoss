# plugin-host-fuse-v1 Spec Delta

## ADDED Requirements

### Requirement: fused plugins MUST NOT auto-reactivate

`fuse(pluginId)` MUST 将 slot 标为 `fused` 并 stop 当前 generation。后续 `activate` MUST 返回 `fused`，直到显式 `reset`。Safe Mode / kill switch MUST 走同一 fuse 路径。

#### Scenario: fuse blocks later activate

- **WHEN** plugin 已被 fuse
- **THEN** 新的 `activate` MUST 失败，code=`fused`
