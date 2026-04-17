## ADDED Requirements

### Requirement: Unified Conversation Semantic Contract

系统 SHALL 以统一的 `ConversationItem` 语义契约承载实时与历史两条链路，避免同一会话内容在不同链路出现双重解释。

#### Scenario: realtime events map to canonical item kinds

- **WHEN** 任一引擎实时事件进入幕布链路
- **THEN** 系统 MUST 将内容映射为统一的 `ConversationItem.kind` 集合（`message/reasoning/diff/review/explore/tool`）
- **AND** 渲染层 MUST NOT 直接消费引擎私有事件字段

#### Scenario: history replay maps to same canonical kinds

- **WHEN** 任一引擎历史会话被恢复
- **THEN** 系统 MUST 生成与实时路径同构的 `ConversationItem` 语义序列
- **AND** 同类数据的状态语义 MUST 与实时路径一致

### Requirement: Engine Adapter and Loader Isolation

系统 SHALL 将引擎差异限制在 Adapter/Loader 层，禁止在幕布渲染内核中引入协议分叉。

#### Scenario: realtime adapter isolates protocol differences

- **WHEN** 新增或调整引擎事件协议
- **THEN** 变更 MUST 优先落在对应 `RealtimeAdapter` 中
- **AND** `Messages` 与通用渲染组件 MUST 不因协议差异新增引擎条件分支

#### Scenario: history loader isolates session format differences

- **WHEN** 不同引擎历史会话格式存在差异
- **THEN** 差异 MUST 在 `HistoryLoader` 层完成归一化
- **AND** 装配层接收到的数据结构 MUST 保持一致

### Requirement: Shared Assembly for Realtime and History

系统 SHALL 使用同一装配策略处理实时增量与历史恢复，确保顺序、状态、去重行为可预测。

#### Scenario: shared assembly preserves ordering and status

- **WHEN** 装配层处理 `message/reasoning/tool` 更新
- **THEN** 同线程中的顺序 MUST 保持稳定
- **AND** `pending/completed/failed` 状态转换 MUST 在实时与历史恢复中等价

#### Scenario: plan and user input remain consistent across paths

- **WHEN** 同线程包含 `TurnPlan` 与 `requestUserInput` 队列状态
- **THEN** 快览与面板 MUST 使用同一计划数据源
- **AND** 用户输入请求 MUST 保持线程隔离、FIFO 和去重语义

### Requirement: Presentation Profile Boundary

系统 SHALL 允许引擎展示差异，但该差异 MUST 限定在展示层 profile，不得改变通用语义。

#### Scenario: engine-specific visual hint does not change item semantics

- **WHEN** Codex 或 OpenCode 启用引擎特有提示（如 lead marker、heartbeat hint）
- **THEN** 这些提示 MUST 仅影响视觉和文案
- **AND** MUST NOT 产生新的通用 item kind 或改变既有 item 语义

#### Scenario: shared renderer remains stable under engine customization

- **WHEN** 新增引擎展示 profile
- **THEN** `renderEntry` 与 `renderSingleItem` 分发路径 MUST 保持不变
- **AND** 现有共用组件行为 MUST 保持兼容

### Requirement: Phased Migration and Rollback Safety

系统 SHALL 提供分阶段迁移与独立回滚开关，确保重构过程中可控发布。

#### Scenario: migration can be enabled by phase flags

- **WHEN** 团队按阶段启用新链路（realtime/history/profile）
- **THEN** 每个阶段 MUST 由独立 feature flag 控制
- **AND** 阶段切换 MUST 不要求同时启用全部新链路

#### Scenario: rollback restores previous stable behavior

- **WHEN** 任一阶段出现一致性回归
- **THEN** 系统 MUST 能通过对应 flag 回退到上一稳定路径
- **AND** 回退后核心链路（消息、工具、计划、提问、历史恢复）MUST 可用
