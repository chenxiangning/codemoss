# plugin-rack-readonly-surface-v1 Spec Delta

## ADDED Requirements

### Requirement: Extensions Plugins tab MUST show a read-only Host rack

Core MUST 在 Extensions → Plugins 展示 Host 与已声明插头。快照 command MUST NOT 激活、disable 或安装插件。Marketplace MUST 仍不可用。

#### Scenario: default-off boot shows declared idle plugs

- **WHEN** 产品启动且 Host 默认 off
- **THEN** 快照 MUST 报告 `hostEnabled=false`
- **AND** MUST 列出 `com.mossx.engine.claude` 与 `com.mossx.notes`
- **AND** 两者 state MUST 为 `idle`

#### Scenario: snapshot cannot activate

- **WHEN** 调用 `get_plugin_rack_snapshot`
- **THEN** command MUST NOT 调用 `activate` / `disable`
- **AND** `command_registry` MUST NOT 包含 `activate_plugin`
