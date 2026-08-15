# plugin-runtime-search-denied-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST deny mossx.search.provider

V1 Broker 对 `mossx.search.provider` MUST 返回 `permission-denied`。

#### Scenario: a ready plugin cannot register a search provider

- **WHEN** Notes Ready
- **AND** `query` 使用 `mossx.search.provider`
- **THEN** 调用 MUST 失败且错误码为 `permission-denied`
