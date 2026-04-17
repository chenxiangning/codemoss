## ADDED Requirements

### Requirement: Session Navigation SHALL Exit Spec Hub Foreground

当 Spec Hub 处于前台打开状态时，系统 SHALL 允许用户通过左侧会话点击直接切换到目标会话，并退出 Spec Hub 前台视图。

#### Scenario: Switch to target session while Spec Hub is open

- **GIVEN** 用户当前处于 Spec Hub 前台视图
- **WHEN** 用户点击左侧任意会话条目
- **THEN** 系统 SHALL 激活并进入目标会话
- **AND** Spec Hub SHALL 不再保持前台覆盖态

#### Scenario: Consecutive session clicks from Spec Hub foreground

- **GIVEN** 用户从 Spec Hub 前台连续点击不同会话
- **WHEN** 每次点击事件触发导航
- **THEN** 系统 SHALL 始终以最近一次点击的会话作为最终激活会话
- **AND** 不得出现停留在 Spec Hub 前台而未进入会话的状态

### Requirement: Completion Feedback SHALL Show Accurate Changed Files

当 OpenSpec 变更创建成功并产生文件变更时，收尾反馈弹窗 SHALL 准确展示变更文件列表，不得错误显示为空。

#### Scenario: Success feedback shows changed files from creation result

- **GIVEN** 变更创建流程返回成功状态
- **AND** 结果中包含非空变更文件列表
- **WHEN** 渲染收尾反馈弹窗
- **THEN** “变更文件”区域 SHALL 展示实际文件路径列表
- **AND** 不得渲染为`(无)`

#### Scenario: Empty marker only appears when no changed files exist

- **GIVEN** 变更创建流程返回成功状态
- **AND** 结果中不包含任何变更文件
- **WHEN** 渲染收尾反馈弹窗
- **THEN** “变更文件”区域 SHALL 显示`(无)`作为空状态标记

### Requirement: Changes List SHALL Render Date-Prefixed Tree in Multiple Views

在 Spec Hub 的变更列表中，系统 SHALL 将名称符合日期前缀模式（`YYYY-MM-DD-*`）的条目按日期进行树形分组展示，并在“全部”与“已归档”视图保持一致。

#### Scenario: Group changes by date prefix in all and archived views

- **GIVEN** 变更集合中包含多个以`YYYY-MM-DD-*`命名的条目
- **WHEN** 用户进入“全部”或“已归档”视图
- **THEN** 系统 SHALL 先按日期前缀生成分组节点
- **AND** 每个分组节点下 SHALL 展示对应变更子项

#### Scenario: Expand and collapse date group node

- **GIVEN** 用户位于“全部”或“已归档”视图且存在日期分组节点
- **WHEN** 用户点击某个日期分组节点
- **THEN** 系统 SHALL 在展开与折叠状态间切换
- **AND** 子项点击行为 SHALL 与现有变更列表一致（进入详情/切换当前变更）

#### Scenario: Fallback bucket for non-date-prefixed items

- **GIVEN** 变更列表中存在不匹配`YYYY-MM-DD-*`命名模式的条目
- **WHEN** 渲染“全部”或“已归档”视图
- **THEN** 系统 SHALL 将该类条目归入“其它”分组
- **AND** 该分组条目 SHALL 可见且可操作，不得被过滤丢失

### Requirement: Toolbar SHALL Provide Expand-Collapse-All Control and Icon Accents

变更列表按钮组前的控制位 SHALL 提供“展开全部/折叠全部”功能，并替代漏斗 icon；系统 SHALL 提供语义化 icon
点缀以增强可读性，但不得削弱文本信息与可访问性。

#### Scenario: Replace funnel slot with expand-collapse-all control

- **GIVEN** 用户打开 Spec Hub 变更列表区域
- **WHEN** 顶部控制区渲染完成
- **THEN** 按钮组前 SHALL 展示“展开全部/折叠全部”控制
- **AND** 原漏斗 icon SHALL 不再作为该位置默认控制

#### Scenario: Expand or collapse all groups in current view

- **GIVEN** 当前视图存在多个日期分组节点
- **WHEN** 用户点击“展开全部”或“折叠全部”控制
- **THEN** 当前视图内所有日期分组 SHALL 同步切换到目标状态
- **AND** 切换筛选视图后 SHALL 不污染其它视图的分组展开状态

#### Scenario: Icon accents preserve clarity and accessibility

- **GIVEN** 系统为分组节点与状态条目添加语义化 icon
- **WHEN** 用户使用鼠标或键盘浏览列表
- **THEN** icon SHALL 仅作为视觉辅助，不替代文本状态
- **AND** 可访问名称、点击热区与交互反馈 SHALL 保持不退化

### Requirement: Spec Hub UI Copy SHALL Be Internationalized

Spec Hub 模块中的可见 UI 文案 SHALL 通过 i18n 资源渲染，不得在生产 UI 中使用硬编码中文/英文文本作为主文案来源。

#### Scenario: Key UI labels are localized in supported locales

- **GIVEN** 用户在 `zh-CN` 或 `en-US` locale 下使用 Spec Hub
- **WHEN** 渲染变更列表、顶部控制区与收尾反馈弹窗
- **THEN** 关键文案（如“其它”“展开全部/折叠全部”“变更文件”“(无)”）SHALL 来自 i18n key
- **AND** 文案 SHALL 随 locale 切换而更新

#### Scenario: No raw i18n key leakage in visible UI

- **GIVEN** i18n 资源已加载并进入 Spec Hub 页面
- **WHEN** 用户浏览主要交互路径（列表浏览、创建反馈、验证前提示）
- **THEN** UI SHALL 不显示原始 key 字符串（例如 `specHub.xxx`）
- **AND** 文案缺失时 SHALL 提供可读回退而非 key 直出
