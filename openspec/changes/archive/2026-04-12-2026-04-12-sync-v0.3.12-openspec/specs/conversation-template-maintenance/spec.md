## MODIFIED Requirements

### Requirement: File Changes Multi-Row Collapse MUST Be Independently Controllable
`File changes` 多文件折叠态 MUST 按文件独立展示与展开。

#### Scenario: multi-file collapsed state renders one row per file
- **WHEN** `File changes` 包含多个文件且卡片处于折叠态
- **THEN** 系统 MUST 渲染逐文件独立折叠行
- **AND** 每行 MUST 显示该文件自身统计

#### Scenario: toggling one row does not affect other rows
- **WHEN** 用户展开/收起任意单行
- **THEN** 系统 MUST 仅改变该行状态
- **AND** 其它行 MUST 保持当前状态
