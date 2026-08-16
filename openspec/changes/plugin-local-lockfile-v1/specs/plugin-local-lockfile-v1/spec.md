# plugin-local-lockfile-v1 Spec Delta

## ADDED Requirements

### Requirement: local install MUST persist a lockfile row without activating Host

stage MUST 写入 `pluginId` + `version`。未知 pluginId MUST 拒绝。lockfile MUST NOT 调用 `activate_plugin`。

#### Scenario: staging Notes writes a lockfile row

- **WHEN** stage `com.mossx.notes`
- **THEN** lockfile MUST 包含 `{ pluginId: com.mossx.notes, version: 1.0.0 }`
- **AND** `activatedHost` MUST 为 false

#### Scenario: unknown pluginId is rejected

- **WHEN** stage `com.unknown.plugin`
- **THEN** lockfile MUST 保持不变
