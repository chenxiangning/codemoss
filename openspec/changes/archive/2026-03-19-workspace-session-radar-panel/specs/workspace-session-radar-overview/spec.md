## ADDED Requirements

### Requirement: Session Radar SHALL Aggregate Running And Recently Completed Sessions Across Projects
系统 SHALL 在 Session Radar 视图中聚合跨项目会话状态，至少覆盖进行中与最近完成两类会话。

#### Scenario: aggregate running sessions across visible workspaces
- **WHEN** 用户打开 Session Radar 视图
- **THEN** 系统 SHALL 展示所有可见 workspace 中的进行中会话
- **AND** 每条会话 SHALL 包含 workspace 名称、thread 名称、引擎标识与更新时间

#### Scenario: include recently completed sessions in bounded window
- **WHEN** 某会话从 processing 切换为 completed
- **THEN** 系统 SHALL 将其加入“最近完成”列表
- **AND** 该列表 SHALL 受时间窗与条数上限约束

### Requirement: Session Radar SHALL Provide Deterministic Ordering And Deduplication
系统 MUST 对 Radar 列表采用稳定排序与去重策略，避免并发更新时出现跳项与重复行。

#### Scenario: deterministic sorting by freshness
- **WHEN** Radar 列表同时存在多条会话
- **THEN** 系统 SHALL 按最新活动时间倒序排序
- **AND** 同时间戳场景 SHALL 使用稳定次序避免列表抖动

#### Scenario: deduplicate by workspace-thread identity
- **WHEN** 同一会话在多个信号源被重复上报
- **THEN** 系统 MUST 基于 `workspaceId + threadId` 去重
- **AND** 列表中 MUST NOT 出现重复会话行

### Requirement: Session Radar SHALL Support Direct Navigation To Target Session
系统 MUST 支持从 Radar 条目一键跳转到目标 workspace/thread，且不破坏当前执行链路。

#### Scenario: jump from running item
- **WHEN** 用户点击进行中会话条目
- **THEN** 系统 SHALL 激活对应 workspace 与 thread
- **AND** 不得中断该会话后台执行

#### Scenario: jump from recently completed item
- **WHEN** 用户点击最近完成会话条目
- **THEN** 系统 SHALL 导航到对应会话上下文
- **AND** 用户 SHALL 能继续查看或追问该会话
