# plugin-local-catalog-groups-v1 Spec Delta

## ADDED Requirements

### Requirement: local catalog MUST group packages by inventory class

本地目录 MUST 先列出试点，再列出后续插件。

#### Scenario: Claude and Notes appear in the pilot catalog group

- **WHEN** 打开市场本地目录
- **THEN** 试点组 MUST 包含 `com.mossx.engine.claude` 与 `com.mossx.notes`
- **AND** 后续组 MUST 包含 `com.mossx.kanban`
