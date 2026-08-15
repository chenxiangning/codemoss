# plugin-storage-disable-isolation-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST keep Notes store after disabling Claude

disable Claude MUST 不撤 Notes store。Claude 自己的 store API MUST 失败。

#### Scenario: disabling Claude keeps the Notes namespace

- **WHEN** Claude 与 Notes 均 Ready 且 Notes 已开 store
- **AND** `disable_plugin("com.mossx.engine.claude")`
- **THEN** Notes `access_store` / `checkpoint_own_store` MUST 成功
- **AND** Claude `open_own_store` MUST 失败
