# plugin-runtime-notifications-denied-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST deny mossx.notifications.publish

V1 Broker 对 `mossx.notifications.publish` MUST 返回 `permission-denied`。

#### Scenario: a ready plugin cannot publish notifications

- **WHEN** Notes Ready
- **AND** `query` 使用 `mossx.notifications.publish`
- **THEN** 调用 MUST 失败且错误码为 `permission-denied`
