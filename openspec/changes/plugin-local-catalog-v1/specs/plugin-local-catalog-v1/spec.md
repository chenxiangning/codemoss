# plugin-local-catalog-v1 Spec Delta

## ADDED Requirements

### Requirement: Market MUST list in-repo packages without installing them

本地目录 MUST 列出仓库内过渡仓。页面 MUST NOT 提供安装 / 卸载按钮。`command_registry` MUST NOT 包含 `install_plugin`。

#### Scenario: local catalog lists Claude, Notes, and Kanban

- **WHEN** 打开市场页
- **THEN** 本地目录 MUST 包含 `com.mossx.engine.claude`、`com.mossx.notes`、`com.mossx.kanban`
- **AND** 页面 MUST NOT 出现安装按钮
