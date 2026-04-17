# project-memory-ui Specification Delta

## MODIFIED Requirements

### Requirement: 搜索和筛选 Toolbar
系统 MUST 提供面向 V2 turn-bound 记忆的搜索与筛选控件，并纳入操作记录筛选。

#### Scenario: 搜索输入防抖
- **GIVEN** 用户持续输入搜索词
- **WHEN** 输入停止并经过 300ms 防抖
- **THEN** 系统 MUST 触发一次搜索刷新
- **AND** MUST NOT 在每次按键时都立即刷新列表

#### Scenario: 操作记录存在性筛选
- **GIVEN** 工具栏提供“有操作记录 / 无操作记录”筛选项
- **WHEN** 用户选择其中一个或多个筛选值
- **THEN** 列表结果 MUST 与筛选状态一致
- **AND** 该筛选 MUST 支持多选组合

### Requirement: 记忆列表显示
系统 MUST 在 V2 列表中突出 turn-bound 记忆的回看价值，而不是沿用旧 detail-first 卡片语义。

#### Scenario: 列表项显示操作记录标记
- **GIVEN** 某条记忆包含 `operationTrail`
- **WHEN** 系统渲染列表项
- **THEN** 列表项 MUST 显示“有操作记录”可视标记
- **AND** 用户点击该标记后 MUST 直接启用“有操作记录”筛选

#### Scenario: 标题回退显示
- **GIVEN** 某条记忆缺少显式标题
- **WHEN** 系统渲染列表项
- **THEN** 标题 MUST 按 `assistantResponse 首句 -> userInput 首句 -> Untitled Memory` 回退

### Requirement: 详情区显示和编辑
系统 MUST 将 V2 turn-bound 记忆详情呈现为结构化只读视图，并移除旧的自由编辑主路径。

#### Scenario: 结构化详情只读展示
- **GIVEN** 用户打开一条 V2 记忆详情
- **WHEN** 系统渲染详情区
- **THEN** 系统 MUST 按 `用户问题 -> 助手思考摘要 -> 助手正文 -> 操作记录时间线` 顺序展示
- **AND** 首次进入时 MUST 默认仅展开“助手正文”
- **AND** `assistantThinkingSummary` 或 `operationTrail` 为空时 MUST 直接隐藏对应区块

#### Scenario: 超长详情文本启用渐进式渲染
- **GIVEN** 当前详情中的 `userInput` 或 `assistantResponse` 超过渐进式渲染阈值
- **WHEN** 系统渲染该区块
- **THEN** 系统 MUST 先渲染首个稳定文本块
- **AND** MUST 通过增量 chunk 继续补齐剩余内容
- **AND** 在补齐过程中 MUST 保持详情区块可交互

#### Scenario: 渐进式渲染任务在卸载时清理
- **GIVEN** 超长文本区块仍在渐进式渲染
- **WHEN** 用户折叠区块、切换详情或关闭窗口
- **THEN** 系统 MUST 取消未完成的 chunk 渲染任务
- **AND** MUST NOT 产生卸载后的状态更新

#### Scenario: V2 详情不显示自由编辑入口
- **GIVEN** 当前详情项为 V2 turn-bound 记忆
- **WHEN** 系统渲染操作区
- **THEN** 系统 MUST NOT 显示自由编辑 title/detail 的输入框与保存按钮
- **AND** 详情交互 MUST 以复制与删除为主

#### Scenario: 统一删除确认文案
- **GIVEN** 用户在详情区执行段落删除、单条操作删除或整条记忆删除
- **WHEN** 弹出二次确认
- **THEN** 确认文案 MUST 使用 `此操作不可撤销，确认删除？`
