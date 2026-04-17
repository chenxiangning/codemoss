# project-memory-consumption Specification Delta

## MODIFIED Requirements

### Requirement: 前端消息注入
系统 MUST 继续采用“手动选择优先”注入策略，不自动恢复旧自动注入路径。

#### Scenario: 未手动选择时不注入
- **WHEN** 用户发送消息且本次未手动选择任何记忆
- **THEN** 系统 SHALL 直接发送用户原始文本
- **AND** SHALL NOT 自动注入任何项目记忆

#### Scenario: 手动选择后注入
- **WHEN** 用户在本次发送前手动选择了项目记忆
- **THEN** 系统 SHALL 仅注入这些已选记忆
- **AND** 注入发送后 SHALL 清空当次选择集合

### Requirement: 用户可见性(Phase 2.2)
系统 MUST 提供以“回看与复盘”为核心的记忆详情与列表体验。

#### Scenario: 详情固定顺序与默认折叠策略
- **GIVEN** 用户打开某条记忆详情
- **WHEN** 系统渲染详情内容
- **THEN** 区块顺序 MUST 固定为 `用户问题 -> 助手思考摘要 -> 助手正文 -> 操作记录时间线`
- **AND** 首次进入详情时 MUST 默认仅展开“助手正文”，其余区块默认折叠

#### Scenario: 空区块隐藏不占位
- **GIVEN** `assistantThinkingSummary` 为空或 `operationTrail` 为空
- **WHEN** 系统渲染详情
- **THEN** 对应区块 MUST 直接隐藏
- **AND** MUST NOT 显示任何占位文本

#### Scenario: 超长正文渐进式渲染
- **GIVEN** `userInput` 或 `assistantResponse` 为超长文本
- **WHEN** 用户展开对应详情区块
- **THEN** 系统 MUST 先展示首个稳定文本块
- **AND** MUST 按原顺序渐进追加剩余内容
- **AND** MUST NOT 截断、重排或改写原文

#### Scenario: 操作记录时间线展示规则
- **GIVEN** 记忆包含多条 `operationTrail` 记录
- **WHEN** 用户查看详情时间线
- **THEN** 时间线 MUST 按时间正序（旧到新）展示
- **AND** 默认仅展示前 50 条并提供“加载更多”
- **AND** 每条记录 MUST 展示 `status` 与自动换算后的 `durationMs`

#### Scenario: 复制整轮内容所见即所得
- **GIVEN** 用户点击“复制整轮内容”
- **WHEN** 系统生成复制文本
- **THEN** 复制内容 MUST 与当前可见详情文本一致
- **AND** `operationTrail` 文本 MUST 包含每条记录的 `status`
- **AND** 复制结果末尾 MUST 追加 `turnId/messageId`

#### Scenario: 渐进式渲染期间复制按钮受控
- **GIVEN** 当前可见长文本区块仍处于渐进式渲染过程中
- **WHEN** 用户查看详情操作区
- **THEN** “复制整轮内容” MUST 显示加载中或暂不可用
- **AND** 待当前可见内容渲染稳定后 MUST 恢复可用

#### Scenario: 列表排序与标题回退
- **GIVEN** 记忆列表加载完成
- **WHEN** 系统渲染列表
- **THEN** 列表 MUST 按 `updatedAt` 降序排序
- **AND** 标题回退链路 MUST 为 `assistantResponse 首句 -> userInput 首句 -> Untitled Memory`

#### Scenario: 操作记录筛选与标记联动
- **GIVEN** 列表项包含“有操作记录”标记
- **WHEN** 用户点击该标记
- **THEN** 系统 MUST 直接启用“有操作记录”筛选
- **AND** “有/无操作记录”筛选 MUST 支持多选组合

#### Scenario: 列表搜索覆盖与高亮策略
- **GIVEN** 用户输入搜索词
- **WHEN** 防抖 300ms 后触发搜索
- **THEN** 搜索范围 MUST 覆盖 `userInput/assistantThinkingSummary/assistantResponse/operationTrail.briefResult`
- **AND** 匹配 MUST 默认不区分大小写
- **AND** 高亮 MUST 仅在详情视图展示，列表摘要不展示高亮

### Requirement: 验收标准(Phase 2.1 MVP)
系统 MUST 保证删除语义清晰、即时、不可撤销，并维持记忆单元完整性。

#### Scenario: 核心段独立删除
- **GIVEN** 用户在详情中删除 `userInput` 或 `assistantThinkingSummary` 或 `assistantResponse`
- **WHEN** 用户完成二次确认
- **THEN** 系统 MUST 立即永久删除对应段落
- **AND** MUST NOT 提供撤销能力

#### Scenario: 单条操作记录删除
- **GIVEN** 用户删除某一条 `operationTrail` 记录
- **WHEN** 用户完成二次确认
- **THEN** 系统 MUST 仅删除该条记录并立即生效
- **AND** MUST NOT 支持编辑该条记录内容

#### Scenario: 空壳静默清理
- **GIVEN** 独立删除后该记忆已无有效核心段且 `operationTrail` 为空
- **WHEN** 系统完成删除操作
- **THEN** 系统 MUST 静默自动删除整条记忆
- **AND** MUST NOT 保留空壳或占位记录
