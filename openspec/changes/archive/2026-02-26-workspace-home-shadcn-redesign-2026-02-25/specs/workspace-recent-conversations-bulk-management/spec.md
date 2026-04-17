# workspace-recent-conversations-bulk-management Specification Delta

## MODIFIED Requirements

### Requirement: 批量删除确认与执行

系统 MUST 在批量删除时以结构化结果处理全成功/部分成功/失败，并保证界面状态与后端结果一致；在新首页视觉结构下，管理态、确认态与删除中态
MUST 具备可辨识差异。

#### Scenario: 确认后批量删除全成功

- **GIVEN** 用户已进入管理态并选中至少一条会话
- **WHEN** 用户确认删除所选会话
- **AND** 所有后端删除请求成功
- **THEN** 系统 MUST 清空选中集合并退出管理态
- **AND** 已删除会话 MUST 从最近会话列表移除

#### Scenario: 确认后批量删除部分失败

- **GIVEN** 用户已进入管理态并选中多条会话
- **WHEN** 用户确认删除所选会话
- **AND** 后端返回部分失败
- **THEN** 系统 MUST 仅移除成功删除的会话
- **AND** MUST 保留失败会话在列表中
- **AND** MUST 将失败会话保留为当前选中态以支持重试
- **AND** MUST 展示失败摘要与错误分类

#### Scenario: 删除期间防重入

- **GIVEN** 系统已提交批量删除请求且尚未完成
- **WHEN** 用户尝试再次触发删除动作
- **THEN** 系统 MUST 禁用批量删除相关按钮
- **AND** MUST 阻止重复提交删除请求
