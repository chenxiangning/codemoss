## ADDED Requirements

### Requirement: 根节点菜单动作不得破坏多 Tab 打开语义
系统 SHALL 在引入根节点上下文菜单后保持现有多 Tab 打开/激活/关闭语义不变。

#### Scenario: root operation does not clear opened tabs
- **GIVEN** 用户已打开多个文件 Tab
- **WHEN** 用户从根节点上下文菜单执行非打开类动作（例如复制路径、在访达中显示）
- **THEN** 系统 SHALL 保留当前已打开 Tab 列表与活动 Tab
- **AND** 不得触发 Tab 重置或文件查看区空态

#### Scenario: create-from-root keeps existing open contract
- **GIVEN** 用户从根节点上下文菜单执行新建文件动作并创建成功
- **WHEN** 系统按现有行为打开或聚焦该文件
- **THEN** 新文件 SHALL 按既有文件树打开契约加入或激活 Tab
- **AND** 已存在的 Tab MUST 保持不丢失
