# plugin-local-stage-v1 Spec Delta

## ADDED Requirements

### Requirement: Market MUST stage local packages without activating Host

本地安装 MUST 只把过渡仓标为 staged。它 MUST 先调用安装预览。它 MUST NOT 读取 entry path、MUST NOT 调用 `activate_plugin`、MUST NOT 改变 Host 插排 state。

#### Scenario: staging a Notes package leaves the Host plug idle

- **WHEN** 在市场本地目录 stage `com.mossx.notes`
- **THEN** 该包 MUST 显示已安装
- **AND** Host 快照里 `com.mossx.notes` MUST 仍是 idle
- **AND** `command_registry` MUST NOT 包含 `activate_plugin`

### Requirement: Market MUST unstage without deleting product source

卸载 MUST 只清除 staged 标记。产品源码 MUST 仍在。

#### Scenario: unstaging Kanban keeps src/features/kanban

- **WHEN** unstage `com.mossx.kanban`
- **THEN** 该包 MUST 显示未安装
- **AND** `src/features/kanban` MUST 仍存在
