## MODIFIED Requirements

### Requirement: Collaboration Mode Switch Consistency

Codex 会话默认协作模式 MUST 为 Plan，且模式切换 MUST 在用户层和运行时保持一致映射。

#### Scenario: default mode initializes to plan in codex

- **GIVEN** 用户进入新的 Codex 会话
- **WHEN** 协作模式初始化
- **THEN** 默认模式 MUST 为 `plan`

#### Scenario: ui and runtime mode mapping stays consistent

- **GIVEN** 用户在 Codex 切换到 `Default`
- **WHEN** 系统发起后续 turn
- **THEN** 用户层模式 MUST 显示 `default`
- **AND** 运行时 MUST 使用 `effective_mode=code`

#### Scenario: mode resolution event drives final ui convergence

- **GIVEN** 前端存在本地乐观模式状态
- **WHEN** 后端发出 `collaboration/modeResolved`
- **THEN** 前端 MUST 以事件值作为最终真值收敛显示
- **AND** MUST 保证线程级一致性

#### Scenario: modeResolved supports snake_case and camelCase fields

- **WHEN** 前端接收 `collaboration/modeResolved`
- **THEN** 事件解析 MUST 兼容 snake_case 与 camelCase 字段命名
- **AND** 两种命名路径 MUST 产出一致语义
