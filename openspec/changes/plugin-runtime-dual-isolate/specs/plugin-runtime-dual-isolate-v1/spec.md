# plugin-runtime-dual-isolate-v1 Spec Delta

## ADDED Requirements

### Requirement: two pilots in one PluginRuntime MUST stay isolated

当同一 PluginRuntime 同时激活 Claude 与 Notes 时，Claude MUST NOT 打开 Notes namespace。disable Notes MUST NOT 撤销 Claude 的 DataPlane stream。

#### Scenario: claude cannot open notes store in the composed runtime

- **WHEN** 两根插头均已激活
- **AND** Claude 作为 caller 访问 Notes data file
- **THEN** access MUST 返回 `permission-denied`

#### Scenario: disabling notes leaves claude stream intact

- **WHEN** 两根插头各有一条 open stream
- **AND** disable Notes
- **THEN** Claude stream codec MUST 仍存在
