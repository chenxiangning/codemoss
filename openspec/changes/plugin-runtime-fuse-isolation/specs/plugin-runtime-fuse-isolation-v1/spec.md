# plugin-runtime-fuse-isolation-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST keep the other plugin's DataPlane after fuse

当 Claude 与 Notes 都 Ready 且各有一条 live stream 时，`fuse_plugin(claude)` MUST 只撤销 Claude 的 stream。Notes 的 stream / query / store MUST 仍可用。

#### Scenario: fusing Claude does not revoke a Notes stream

- **WHEN** Claude 与 Notes 都已 activate 并各自 open_stream
- **AND** `fuse_plugin("com.mossx.engine.claude")`
- **THEN** Claude stream MUST 消失
- **AND** Notes stream / query / open_own_store MUST 仍成功
