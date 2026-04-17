## ADDED Requirements

### Requirement: OpenCode 会话列表必须提供稳定排序时间基线

系统 MUST 为 OpenCode 会话列表提供稳定时间基线字段，用于最近会话排序与重启恢复。

#### Scenario: stable timestamp source for opencode sessions

- **WHEN** 系统加载 OpenCode 会话列表
- **THEN** 每条会话 MUST 具备可用于排序的稳定时间信号
- **AND** 当主信号缺失时 MUST 按定义的回退顺序处理

### Requirement: OpenCode 会话时间解析失败必须可观测

系统 MUST 在 OpenCode 会话时间无法解析时输出可观测诊断信息。

#### Scenario: timestamp parse failure

- **WHEN** OpenCode 会话时间字段解析失败
- **THEN** 系统 MUST 记录可诊断日志
- **AND** 列表展示 MUST 使用安全回退而非崩溃或随机排序
