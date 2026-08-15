# plugin-runtime-brokered-denied-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse remaining V1 brokered capabilities

V1 只读 Broker 只授权 `mossx.workspace.read`。`mossx.git.read`、`mossx.git.write`、`mossx.network.fetch` 与 `mossx.storage.readwrite` MUST 返回 `permission-denied`。

#### Scenario: ready plugin cannot query remaining brokered capabilities

- **WHEN** Notes 已 ready
- **THEN** `query(..., mossx.workspace.read)` MUST 成功
- **AND** git.read / git.write / network.fetch / storage.readwrite MUST 失败且错误码为 `permission-denied`
