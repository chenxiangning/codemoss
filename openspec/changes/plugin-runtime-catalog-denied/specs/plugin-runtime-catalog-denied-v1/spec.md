# plugin-runtime-catalog-denied-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST deny leftover V1 catalog capabilities

V1 Broker 对 context / command / tool / UI / settings / status catalog 能力 MUST 返回 `permission-denied`。

#### Scenario: a ready plugin cannot query leftover catalog capabilities

- **WHEN** Notes Ready
- **AND** `query` 使用剩余 catalog 能力
- **THEN** 调用 MUST 失败且错误码为 `permission-denied`
