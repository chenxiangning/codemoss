# plugin-rack-owner-class-v1 Spec Delta

## ADDED Requirements

### Requirement: Market rack MUST show inventory owner class without activating

只读快照 MUST 为每个已声明插头提供 `ownerClass`。`com.mossx.engine.claude` 与 `com.mossx.notes` MUST 为 `pilot`。其余已声明插头 MUST 为 `later-plugin`。本 change MUST NOT 激活、disable 或安装插件。

#### Scenario: pilots and later plugs keep their inventory class

- **WHEN** 产品启动且 Host 默认 off
- **THEN** Claude 与 Notes 的 `ownerClass` MUST 为 `pilot`
- **AND** Project Map / Browser / Intent Canvas / later CLI 的 `ownerClass` MUST 为 `later-plugin`
- **AND** 全部 state MUST 仍为 `idle`
