## MODIFIED Requirements

### Requirement: Codex Rewind Execution Safety MUST Match Validated Restore Rules

Codex rewind 在执行会话回溯前后 MUST 保持工作区恢复语义一致，并覆盖无 diff、失败回滚边界；当用户关闭“回退工作区文件”开关时，系统 MUST 跳过工作区恢复步骤但保持会话回溯链路可用。

#### Scenario: missing inline diff still restores via kind or structured fields when restore toggle is enabled
- **WHEN** 文件变更条目缺少 inline diff
- **AND** 条目仍可提供可判定 kind 或 structured `old_string/new_string`
- **AND** 用户确认 rewind 时保持“回退工作区文件”开关开启
- **THEN** 系统 MUST 继续执行文件恢复，而不是直接跳过
- **AND** 恢复结果 SHALL 可预测且可回归验证

#### Scenario: specific kind wins over generic modified when restore toggle is enabled
- **WHEN** 同一路径的变更来源同时出现 `modified` 与更具体 kind（`add/delete/rename`）
- **AND** 用户确认 rewind 时保持“回退工作区文件”开关开启
- **THEN** 系统 MUST 优先采用更具体 kind 作为恢复语义
- **AND** 不得因为 generic kind 覆盖而产生错误恢复结果

#### Scenario: rewind fork failure rolls workspace snapshots back when restore toggle is enabled
- **WHEN** 工作区恢复已应用但会话 rewind/fork 失败
- **AND** 用户确认 rewind 时保持“回退工作区文件”开关开启
- **THEN** 系统 MUST 自动恢复回溯前快照
- **AND** 用户侧不得残留半回溯状态文件

#### Scenario: first user anchor avoids meaningless fork session
- **WHEN** 回溯目标命中会话首条 user message
- **THEN** 系统 MUST 执行首条锚点专用生命周期策略
- **AND** 不得生成无意义 fork 线程

#### Scenario: workspace restore is skipped when toggle is disabled
- **WHEN** 用户在 Codex rewind 确认弹层关闭“回退工作区文件”开关并确认回溯
- **THEN** 系统 MUST 跳过 workspace 文件恢复与快照回滚逻辑
- **AND** 系统 MUST 继续执行会话回溯主链路

## ADDED Requirements

### Requirement: Codex Rewind Workspace Restore Toggle

Codex rewind 确认弹层 MUST 提供“回退工作区文件”开关，并与执行链路参数保持一致。

#### Scenario: toggle is visible and defaults to enabled
- **WHEN** 用户打开 Codex rewind 确认弹层
- **THEN** 系统 MUST 显示“回退工作区文件”开关
- **AND** 开关默认值 MUST 为开启状态

#### Scenario: toggle choice is applied to rewind execution
- **WHEN** 用户在确认弹层切换开关并点击确认
- **THEN** 系统 MUST 将开关值透传到 rewind 执行链路
- **AND** 执行行为 MUST 与开关状态一致
