## ADDED Requirements

### Requirement: Claude Rewind Workspace Restore Toggle

Claude rewind 确认弹层 MUST 提供“回退工作区文件”开关，用于控制是否执行 workspace 文件回退。

#### Scenario: toggle is visible and defaults to enabled
- **WHEN** 用户打开 Claude rewind 确认弹层
- **THEN** 系统 MUST 显示“回退工作区文件”开关
- **AND** 开关默认值 MUST 为开启状态

#### Scenario: enabled toggle keeps current restore behavior
- **WHEN** 用户保持开关为开启并确认 rewind
- **THEN** 系统 MUST 执行现有 workspace 文件回退流程
- **AND** 文件回退失败时 MUST 继续按既有回滚规则处理

#### Scenario: disabled toggle skips workspace restore but keeps session rewind
- **WHEN** 用户将开关关闭并确认 rewind
- **THEN** 系统 MUST 跳过 workspace 文件回退流程
- **AND** 系统 MUST 继续执行会话回溯主链路

#### Scenario: toggle state resets to enabled on each dialog open
- **WHEN** 用户关闭并重新打开 Claude rewind 确认弹层
- **THEN** 开关状态 MUST 重置为开启
- **AND** 系统 MUST NOT 依赖上次会话的开关状态
