# plugin-local-lockfile-hash-v1 Spec Delta

## ADDED Requirements

### Requirement: local lockfile MUST bind pluginId+version to one artifactHash

stage MUST 写入稳定 `artifactHash`。同一 `pluginId + version` 换 hash MUST 拒绝，且 lockfile MUST 保持原行。

#### Scenario: conflicting hash is rejected

- **WHEN** Notes 已 staged，再以不同 hash stage
- **THEN** 结果 MUST 失败
- **AND** lockfile MUST 仍是原来的 hash
