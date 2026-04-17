# codex-chat-canvas-plan-visibility Specification Delta

## MODIFIED Requirements

### Requirement: Plan Panel Empty and Waiting Semantics

系统 MUST 在“已有计划数据”时优先展示计划内容，不得被协作模式空态提示覆盖。

#### Scenario: code mode with existing plan still shows plan content

- **GIVEN** 当前协作模式为 Code
- **AND** 当前线程已有有效计划数据
- **WHEN** 渲染右侧 Plan 面板或全局 Plan 快览
- **THEN** 系统 MUST 展示计划步骤内容
- **AND** MUST NOT 显示“切换到 Plan 模式后可查看计划”等阻断提示

#### Scenario: code mode without plan keeps guidance message

- **GIVEN** 当前协作模式为 Code
- **AND** 当前线程无有效计划数据
- **WHEN** 渲染 Plan 区域
- **THEN** 系统 MAY 显示模式引导提示
- **AND** 提示 MUST 不误导已有计划场景

### Requirement: Plan Quick Entry in Edit Row

计划快览 MUST 在长计划场景提供完整可达内容，不得被容器裁切。

#### Scenario: quick plan preview supports full content access

- **GIVEN** 编辑行 Plan 快览包含超过可视高度的步骤列表
- **WHEN** 用户展开快览
- **THEN** 系统 MUST 支持滚动查看完整步骤
- **AND** 最后一条步骤 MUST 可见可达

### Requirement: Plan Panel Dismiss Control

右侧 Plan 面板 MUST 提供显式关闭能力。

#### Scenario: close plan panel from panel header

- **WHEN** 用户点击 Plan 面板关闭按钮
- **THEN** 系统 MUST 隐藏右侧 Plan 面板
- **AND** 当前线程计划数据 MUST 保留

#### Scenario: reopen plan panel after closing

- **GIVEN** Plan 面板已关闭
- **WHEN** 用户点击“查看完整 Plan 面板”或等效入口
- **THEN** 系统 MUST 重新显示右侧 Plan 面板
- **AND** 面板内容 MUST 与当前线程计划状态一致
