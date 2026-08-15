# plugin-runtime-read-only-broker-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST keep the V1 broker read-only

`query` MUST 把 capability 交给 Broker。Ready plugin 的 `mossx.workspace.read` MUST 成功。`mossx.workspace.write` 与 `mossx.process.spawn` MUST 返回 `permission-denied`。

#### Scenario: ready plugin can read but cannot write or spawn

- **WHEN** Notes 已 ready
- **THEN** `query(..., mossx.workspace.read)` MUST 成功
- **AND** `query(..., mossx.workspace.write)` MUST 失败且错误码为 `permission-denied`
- **AND** `query(..., mossx.process.spawn)` MUST 失败且错误码为 `permission-denied`
