# plugin-broker-fuse-deny-v1 Spec Delta

## ADDED Requirements

### Requirement: a fused plugin MUST NOT receive workspace handles

当 Host slot 为 `fused` 时，Capability Broker MUST 拒绝任何 capability query，包括 `mossx.workspace.read`。失败响应 MUST NOT 包含 workspace root。

#### Scenario: fused plugin cannot read fixture workspace

- **WHEN** plugin 已被 `fuse`
- **AND** Broker 查询 `mossx.workspace.read`
- **THEN** query MUST 失败
- **AND** 调用方 MUST NOT 得到 workspace_root
