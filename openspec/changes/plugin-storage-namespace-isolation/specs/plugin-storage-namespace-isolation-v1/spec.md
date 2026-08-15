# plugin-storage-namespace-isolation-v1 Spec Delta

## ADDED Requirements

### Requirement: a plugin MUST NOT open another plugin's storage namespace

Storage access MUST 携带 caller `pluginId`。当 caller 与 target 不一致时，Core MUST 返回 `permission-denied`，MUST NOT 返回对方 data path。

#### Scenario: claude cannot access notes namespace

- **WHEN** caller 为 `com.mossx.engine.claude`
- **AND** target 为 `com.mossx.notes`
- **THEN** access MUST 失败且错误码为 `permission-denied`

#### Scenario: notes can access its own namespace

- **WHEN** caller 与 target 均为 `com.mossx.notes`
- **THEN** access MUST 返回该 plugin 的 namespace
