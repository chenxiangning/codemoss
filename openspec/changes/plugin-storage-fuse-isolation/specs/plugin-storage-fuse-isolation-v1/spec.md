# plugin-storage-fuse-isolation-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST keep Notes store after fusing Claude

fuse Claude MUST 不撤 Notes store。Claude 自己的 store API MUST 失败。

#### Scenario: fusing Claude keeps the Notes namespace

- **WHEN** Claude 与 Notes 均 Ready 且 Notes 已开 store
- **AND** `fuse_plugin("com.mossx.engine.claude")`
- **THEN** Notes `access_store` / `checkpoint_own_store` MUST 成功
- **AND** Claude `open_own_store` MUST 失败
