# plugin-local-lockfile-version-v1 Spec Delta

## ADDED Requirements

### Requirement: Market MUST show the staged lockfile version

已安装卡片 MUST 显示 lockfile `version`。未安装卡片 MUST 显示过渡仓默认 version。

#### Scenario: staged Notes shows version 1.0.0

- **WHEN** stage `com.mossx.notes`
- **THEN** Notes 卡片 MUST 显示 `1.0.0`
