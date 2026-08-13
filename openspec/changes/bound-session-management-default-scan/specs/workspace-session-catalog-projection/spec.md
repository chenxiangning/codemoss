# workspace-session-catalog-projection Spec Delta

## ADDED Requirements

### Requirement: Session Management default scan MUST be Bounded

Session Management 的默认 `list_workspace_sessions` 与 `get_workspace_session_projection_summary` MUST 使用 Bounded scan（现有 page size / `SESSION_CATALOG_DEFAULT_LIMIT` + lookahead）。`keyword`、`folderId`、`archived` MUST NOT 单独把 scan 升为 Exhaustive。

#### Scenario: opening Session Management uses Bounded scan

- **WHEN** 用户打开设置页会话管理且未确认扫描全部
- **THEN** 系统 MUST 以 Bounded 扫描返回第一页
- **AND** MUST 通过 `sourceStatuses[].scanCapReached` 暴露「可能未扫全」

#### Scenario: explicit scan-all is confirmed

- **WHEN** 用户确认「扫描全部」
- **THEN** 查询 MUST 带 `scanMode=exhaustive`
- **AND** 归属/归档/删除语义 MUST 与确认前一致，只是扫描范围变为全量

#### Scenario: scan-all can be cancelled

- **WHEN** 用户在 Exhaustive 请求未完成时取消
- **THEN** 系统 MUST 丢弃该 in-flight 结果并回到 Bounded 查询
- **AND** MUST NOT 把未完成的 Exhaustive 结果写成权威空集

### Requirement: Sidebar and startup MUST NOT request Exhaustive catalog

启动、窗口 focus、侧栏 hydrate MUST NOT 调用 `SessionCatalogScanMode::Exhaustive`。后台 archive/assign 批处理 MAY 继续 Exhaustive，但 MUST NOT 挂在 Settings 页面 mount。

#### Scenario: sidebar hydrate stays off Exhaustive

- **WHEN** 用户进入已有 workspace 的侧栏冷路径或 focus-refresh
- **THEN** 系统 MUST NOT 为了标题/排序发起 Exhaustive `list_workspace_sessions`
