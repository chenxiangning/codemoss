# plugin-rack-declared-cli-plugs-v1 Spec Delta

## ADDED Requirements

### Requirement: Market rack MUST declare inventoried later CLI plugs as idle

只读插排 MUST 在现有 Feature 插头之后列出 `com.mossx.engine.codex`、`com.mossx.engine.gemini`、`com.mossx.engine.grok`、`com.mossx.engine.kimi`、`com.mossx.engine.opencode`、`com.mossx.engine.pi`。这些插头 MUST 来自现有 ownership inventory。默认启动 MUST 仍全部 `idle`。本 change MUST NOT 激活、disable 或安装它们，MUST NOT 把已删 CLI 拷回 Core。

#### Scenario: default-off boot lists eleven declared idle plugs

- **WHEN** 产品启动且 Host 默认 off
- **THEN** 快照 MUST 列出 Claude、Notes、Project Map、Browser、Intent Canvas 与六个 later CLI
- **AND** 全部 state MUST 为 `idle`
- **AND** Host MUST NOT 为 later CLI 创建 slot

#### Scenario: snapshot still cannot activate later CLI plugs

- **WHEN** 调用 `get_plugin_rack_snapshot`
- **THEN** command MUST NOT 调用 `activate` / `disable`
- **AND** `command_registry` MUST NOT 包含 `activate_plugin`
