# plugin-kanban-package-layer-v1 Spec Delta

## ADDED Requirements

### Requirement: Kanban MUST have an in-repo package layer without leaving Core

仓库 MUST 提供 `packages/plugin-kanban` 过渡仓。`pluginId` MUST 为 `com.mossx.kanban`。产品实现 MUST 仍在 `src/features/kanban`。boot MUST NOT 安装该包。

#### Scenario: package manifest is accepted and stays out of boot

- **WHEN** 解析 `packages/plugin-kanban/.mossx-plugin/plugin.json`
- **THEN** parser MUST 接受
- **AND** boot 源码 MUST NOT 引用该目录
