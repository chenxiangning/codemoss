## ADDED Requirements

### Requirement: 最近会话管理态与多选

系统 MUST 在 WorkspaceHome 最近会话区域提供管理态，支持多选会话并显示选中状态。

#### Scenario: 进入管理态

- **WHEN** 用户点击“管理/多选”入口
- **THEN** 系统 MUST 将最近会话区域切换为管理态
- **AND** 会话项点击行为 MUST 从“进入会话”切换为“切换选中”

#### Scenario: 管理态展示选中数量

- **WHEN** 用户在管理态选择至少 1 条会话
- **THEN** 系统 MUST 显示“已选 N 条”
- **AND** N MUST 与当前选中集合一致

#### Scenario: 退出管理态

- **WHEN** 用户点击“取消”
- **THEN** 系统 MUST 退出管理态
- **AND** 清空当前选中集合

### Requirement: 全选与取消全选

系统 MUST 在管理态提供全选与取消全选能力。

#### Scenario: 全选当前列表

- **WHEN** 用户点击“全选”
- **THEN** 系统 MUST 选中当前最近会话列表中的全部条目
- **AND** 选中数量 MUST 等于当前列表长度

#### Scenario: 取消全选

- **WHEN** 用户点击“取消全选”
- **THEN** 系统 MUST 清空当前选中集合
- **AND** 批量删除按钮 MUST 进入禁用态

### Requirement: 批量删除确认与执行

系统 MUST 在批量删除前执行确认，并在确认后删除全部选中会话。

#### Scenario: 删除前确认

- **WHEN** 用户点击“删除已选”
- **THEN** 系统 MUST 弹出确认提示
- **AND** 提示中 MUST 包含将删除的条目数量

#### Scenario: 确认后删除

- **WHEN** 用户确认删除
- **THEN** 系统 MUST 逐条删除选中会话
- **AND** 删除完成后 MUST 清空选中集合并保持在可继续操作状态

#### Scenario: 删除期间防重入

- **WHEN** 系统处于删除进行中
- **THEN** 系统 MUST 禁用批量删除相关按钮
- **AND** MUST 阻止重复提交删除请求

### Requirement: 浏览态兼容性

系统 MUST 保持非管理态的既有导航行为不变。

#### Scenario: 浏览态点击进入会话

- **WHEN** 用户处于非管理态并点击最近会话项
- **THEN** 系统 MUST 进入该会话
- **AND** 不得触发选中态变更
