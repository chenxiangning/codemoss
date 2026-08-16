# plugin-rack-declared-later-plugs-v1 Spec Delta

## ADDED Requirements

### Requirement: Market rack MUST declare the next inventoried later plugs as idle

只读插排 MUST 在 Claude / Notes 之后列出 `com.mossx.project-map`、`com.mossx.browser`、`com.mossx.intent-canvas`。这些插头 MUST 来自现有 ownership inventory。默认启动 MUST 仍全部 `idle`。本 change MUST NOT 激活、disable 或安装它们。

#### Scenario: default-off boot lists five declared idle plugs

- **WHEN** 产品启动且 Host 默认 off
- **THEN** 快照 MUST 列出 Claude、Notes、Project Map、Browser、Intent Canvas
- **AND** 全部 state MUST 为 `idle`
- **AND** Host MUST NOT 为后三个插头创建 slot

#### Scenario: snapshot still cannot activate later plugs

- **WHEN** 调用 `get_plugin_rack_snapshot`
- **THEN** command MUST NOT 调用 `activate` / `disable`
- **AND** `command_registry` MUST NOT 包含 `activate_plugin`
