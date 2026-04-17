# project-memory-crud Specification Delta

## MODIFIED Requirements

### Requirement: 读取记忆 (Read)
系统 MUST 提供面向 V2 turn-bound 模型的读取能力，并同时满足列表/详情所需的兼容消费字段。

#### Scenario: 按 ID 查询返回 V2 核心字段
- **GIVEN** 记忆 ID 为 `memory-123`
- **WHEN** 调用 `project_memory_get(memory-123, workspace-id)`
- **THEN** 返回结果 MUST 包含 `id/workspaceId/threadId/turnId/messageId/createdAt/updatedAt`
- **AND** MUST 包含 `title/kind/importance/tags/source/fingerprint`
- **AND** MUST 包含 `userInput/assistantThinkingSummary/assistantResponse/operationTrail`

#### Scenario: 兼容字段仅作为读模型
- **GIVEN** 返回结果中仍包含 `summary`、`detail` 或 `cleanText`
- **WHEN** 客户端消费这些字段
- **THEN** 系统 MUST 将其视为兼容读模型或索引字段
- **AND** MUST NOT 允许这些字段反向覆盖 V2 真值字段

#### Scenario: 列表搜索覆盖全文与操作结果
- **GIVEN** 某条记忆的 `assistantResponse` 或 `operationTrail.briefResult` 命中搜索词
- **WHEN** 调用 `project_memory_list` 并指定 query
- **THEN** 系统 MUST 返回该记忆
- **AND** 搜索范围 MUST 覆盖 `userInput/assistantThinkingSummary/assistantResponse/operationTrail.briefResult`
- **AND** 匹配 MUST 默认不区分大小写

#### Scenario: 列表查询支持操作记录存在性筛选
- **GIVEN** workspace 中同时存在“有操作记录”和“无操作记录”的记忆
- **WHEN** 调用 `project_memory_list` 并指定操作记录存在性筛选
- **THEN** 系统 MUST 仅返回符合筛选条件的记忆
- **AND** 该筛选 MUST 支持多选组合

#### Scenario: 列表与详情采用分离读模型
- **GIVEN** 某 workspace 中存在包含超长 `userInput` 或 `assistantResponse` 的记忆
- **WHEN** 调用 `project_memory_list`
- **THEN** 系统 MAY 返回用于列表/筛选/搜索的轻量 projection
- **AND** MUST NOT 要求列表首屏先完整水合每条记忆原文
- **AND** 当调用 `project_memory_get` 时 MUST 返回该记忆的完整 canonical 字段

#### Scenario: V2 读取命令不得暴露文件路径
- **GIVEN** 前端调用 `project_memory_list` 或 `project_memory_get`
- **WHEN** 系统传递读取参数到 Rust 后端
- **THEN** 命令载荷 MUST 仅包含类型化业务参数
- **AND** MUST NOT 接受任意 shard/file 路径参数

### Requirement: 更新记忆 (Update)
系统 MUST 提供受控的结构化 patch 能力，用于 fusion 写入与删除治理，不再允许 V2 主路径以自由文本 detail 覆写记录。

#### Scenario: 结构化 patch 更新核心段
- **GIVEN** V2 记忆需要写入或删除 `assistantThinkingSummary`
- **WHEN** 系统执行更新
- **THEN** 系统 MUST 直接更新对应 canonical 字段
- **AND** 必要时 MUST 重算 `title` 与兼容读模型字段

#### Scenario: 删除单条操作记录
- **GIVEN** V2 记忆包含多条 `operationTrail`
- **WHEN** 系统指定某条操作记录执行删除
- **THEN** 系统 MUST 仅移除目标记录
- **AND** MUST 保持其余操作记录顺序不变

#### Scenario: 自由文本 detail 不得覆写 V2 真值
- **GIVEN** 调用方尝试以自由文本 `detail` 覆盖一条 V2 turn-bound 记忆
- **WHEN** 系统执行更新
- **THEN** 系统 MUST NOT 将该 `detail` 视为真值来源
- **AND** V2 主路径 MUST 继续以结构化 turn 字段为准

#### Scenario: 结构化更新后刷新投影与索引
- **GIVEN** 系统对 V2 记忆执行结构化 patch、段落删除或单条操作删除
- **WHEN** 更新成功落盘
- **THEN** 系统 MUST 失效并重建受影响记忆的列表 projection 与搜索索引
- **AND** 下一次 `project_memory_list` 或 `project_memory_get` MUST 返回最新状态

#### Scenario: V2 更新命令不得接受路径型载荷
- **GIVEN** 前端调用 `project_memory_update`
- **WHEN** 系统发送结构化 patch 到 Rust 后端
- **THEN** 命令载荷 MUST 仅包含 `workspaceId`、`memoryId` 与结构化 patch
- **AND** MUST NOT 接受任意文件路径或分片定位参数

### Requirement: 删除记忆 (Delete)
系统 MUST 在 V2 主路径中提供整条记忆硬删除能力，不再以软删除作为默认语义。

#### Scenario: 硬删除移除记录
- **GIVEN** 记忆 ID 为 `memory-123`
- **WHEN** 调用 `project_memory_delete(memory-123, workspace-id)`
- **THEN** 系统 MUST 将该记录从存储中物理移除
- **AND** 后续列表与详情读取 MUST 不再返回该记录

#### Scenario: 重复删除保持幂等
- **GIVEN** 记忆已被删除或不存在
- **WHEN** 再次调用 `project_memory_delete`
- **THEN** 系统 SHOULD 返回成功语义
- **AND** MUST NOT 创建墓碑记录或空壳占位

#### Scenario: 删除后不得出现 stale 命中
- **GIVEN** 某条记忆、某核心段或某条 `operationTrail` 已完成删除
- **WHEN** 用户随后执行列表读取、详情读取或搜索
- **THEN** 系统 MUST NOT 返回已删除内容
- **AND** MUST NOT 在旧缓存或旧搜索结果中继续命中该内容

#### Scenario: V2 删除命令不得回流 V1 删除模型
- **GIVEN** 前端调用 `project_memory_delete`
- **WHEN** V2 主路径执行删除
- **THEN** 命令载荷 MUST 仅包含 `workspaceId` 与 `memoryId`
- **AND** MUST NOT 暴露任意文件路径参数
- **AND** MUST NOT 暴露 V1 风格 `hardDelete` 语义开关
