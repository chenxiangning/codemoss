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

#### Scenario: plan panel copy is localized

- **GIVEN** 用户在非英文语言环境打开 Plan 面板
- **WHEN** 渲染标题与空态文案
- **THEN** 文案 MUST 通过 i18n 渲染
- **AND** MUST NOT 出现硬编码英文残留

### Requirement: Plan Panel Dismiss Control

右侧 Plan 面板 MUST 提供显式关闭能力。

#### Scenario: close plan panel from panel header

- **WHEN** 用户点击 Plan 面板关闭按钮
- **THEN** 系统 MUST 隐藏右侧 Plan 面板
- **AND** 当前线程计划数据 MUST 保留
