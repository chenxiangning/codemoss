# plugin-runtime-provider-denied-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse provider, slot, and private capabilities through query

V1 只读 Broker 不得通过 `query` 授权 provider、UI slot 或 `<pluginId>.*` 私有 capability。这些查询 MUST 返回 `permission-denied`。

#### Scenario: ready plugin cannot query provider slot or private capabilities

- **WHEN** Notes 已 ready
- **THEN** `query(..., mossx.workspace.read)` MUST 成功
- **AND** `mossx.engine.provider` / `mossx.ui.slot.workspace.main` / `com.mossx.notes.private` MUST 失败且错误码为 `permission-denied`
