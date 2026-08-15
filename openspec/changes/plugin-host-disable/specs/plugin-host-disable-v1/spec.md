# plugin-host-disable-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST disable a plugin without deleting its Core implementation

`disable(pluginId)` MUST 停止该 plugin 已启动 entry，MUST 将 slot 置为 `disabled`。disabled 之后 activate 与 Broker query MUST 失败，直到 `reset`。本 change MUST NOT 删除产品 Claude / Notes 源码。

#### Scenario: disable stops entries and blocks later activate

- **WHEN** plugin 已 ready
- **AND** 调用 `disable`
- **THEN** slot state MUST 为 `disabled`
- **AND** 再次 activate MUST 失败

#### Scenario: disabled plugin cannot read workspace

- **WHEN** plugin 已被 disable
- **THEN** Broker `mossx.workspace.read` MUST 失败
