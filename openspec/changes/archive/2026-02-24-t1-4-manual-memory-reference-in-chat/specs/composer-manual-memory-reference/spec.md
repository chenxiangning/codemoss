# composer-manual-memory-reference Specification Delta

## MODIFIED Requirements

### Requirement: `@@` 触发项目记忆候选

系统 MUST 在 Composer 中支持 `@@` 触发项目记忆候选列表，用于用户主动关联记忆。

#### Scenario: 输入 `@@` 打开候选

- **WHEN** 用户在聊天输入框输入 `@@`
- **THEN** 系统 SHALL 打开项目记忆候选列表
- **AND** 候选来源 SHALL 限定为当前 workspace 的项目记忆

#### Scenario: `@` 文件引用不受影响

- **WHEN** 用户输入单个 `@`
- **THEN** 系统 SHALL 保持现有文件引用自动补全语义
- **AND** `@@` 语义 SHALL 与 `@` 语义隔离

### Requirement: 候选列表支持多选

系统 MUST 支持用户从记忆候选中多选并维持本次发送上下文。

#### Scenario: 多选记忆

- **WHEN** 用户在候选列表中连续选择多条记忆
- **THEN** 系统 SHALL 保留全部选中项
- **AND** Composer 区域 SHALL 可见地展示已选记忆

#### Scenario: 取消选择

- **WHEN** 用户移除已选记忆项
- **THEN** 该记忆 SHALL 从本次发送集合中移除

### Requirement: 候选信息可读与可比较

系统 MUST 在 `@@` 候选中提供足够信息，支持用户在选择前完成判断。

#### Scenario: 候选卡片信息完整

- **WHEN** 系统渲染记忆候选项
- **THEN** 每项 SHALL 至少展示标题与摘要片段
- **AND** SHALL 展示关键元信息（如 kind、优先级、更新时间、标签中的一组或多组）

#### Scenario: 选择前可查看细节

- **WHEN** 用户仅高亮/聚焦某条候选但未选择
- **THEN** 系统 SHALL 提供该候选的细节预览
- **AND** 预览行为 SHALL NOT 改变该候选的选中状态

#### Scenario: 长文本可控展示

- **WHEN** 候选摘要或详情内容较长
- **THEN** 系统 SHALL 采用折叠/截断策略避免挤占输入区
- **AND** 用户 SHALL 可以展开查看完整内容

### Requirement: 一次性注入（One-shot）

系统 MUST 仅在当次发送注入用户手动选择的记忆，发送完成后自动清空选择。

#### Scenario: 发送时注入一次

- **WHEN** 用户已选择 2 条记忆并发送消息
- **THEN** 系统 SHALL 在该次请求中注入这 2 条记忆
- **AND** 注入完成后 SHALL 清空本次已选记忆

#### Scenario: 未选择时不注入

- **WHEN** 用户未选择任何记忆并发送消息
- **THEN** 系统 SHALL 不注入任何项目记忆上下文

### Requirement: 选择数据的会话隔离

系统 MUST 保证手动选择仅作用于当前会话发送，不跨会话泄漏。

#### Scenario: 切换会话不继承选择

- **WHEN** 用户切换到另一个 thread 或 workspace
- **THEN** 系统 SHALL 不复用上一会话的手动记忆选择
