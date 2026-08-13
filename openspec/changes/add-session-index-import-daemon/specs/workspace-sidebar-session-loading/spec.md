## ADDED Requirements

### Requirement: Importer refresh MUST stay Index-only

侧栏因 `session-index-imported` 刷新时 MUST 使用 first-paint SQLite 路径，MUST NOT `forceSessionIndexSync` 或 `includeEngineDiskLists`。

#### Scenario: import event does not start disk lists

- **WHEN** 前端收到 `session-index-imported`
- **THEN** 刷新 MUST `startupHydrationMode=first-paint`
- **AND** MUST NOT 设置 `includeEngineDiskLists`
