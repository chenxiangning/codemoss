# plugin-rack-lockfile-version-v1 Spec Delta

## ADDED Requirements

### Requirement: Host rack MUST show lockfile version without changing slot state

插排卡片 MUST 显示 lockfile version。Host `state` MUST 仍是 idle，除非 snapshot 另有 runtime 状态。

#### Scenario: staged Notes rack card shows 1.0.0 and stays idle

- **WHEN** stage `com.mossx.notes`
- **THEN** Features 组 MUST 显示 `1.0.0`
- **AND** 同一卡片 MUST 仍显示空闲
