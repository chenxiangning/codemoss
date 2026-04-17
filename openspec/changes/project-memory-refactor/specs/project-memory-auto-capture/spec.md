# project-memory-auto-capture Specification Delta

## MODIFIED Requirements

### Requirement: 输入采集确权 (A - Input Capture)
系统 MUST 保持现有问答自动采集触发机制不变，并在采集上下文中稳定关联 `workspaceId/threadId/turnId/messageId`。

#### Scenario: 双引擎保持原触发链路
- **GIVEN** 用户通过 Claude 或 Codex 发送消息
- **WHEN** 发送事件进入既有自动采集链路
- **THEN** 系统 MUST 继续复用现有 `project_memory_capture_auto` 触发机制
- **AND** MUST 记录当前轮次关联键（`workspaceId/threadId/turnId/messageId`）
- **AND** MUST NOT 引入新的发送侧触发入口

#### Scenario: 输入采集失败不阻塞主链路
- **GIVEN** 自动采集调用失败
- **WHEN** 用户发送消息
- **THEN** 系统 MUST 降级为“仅发送消息”
- **AND** MUST NOT 阻塞对话主流程

#### Scenario: capture 阶段不得改写 canonical userInput
- **GIVEN** 用户发送原始文本进入自动采集
- **WHEN** 系统执行噪声过滤、去重或脱敏相关逻辑
- **THEN** 系统 MAY 使用规范化文本参与噪声过滤与指纹计算
- **AND** MUST 保证 canonical `userInput` 保留用户原文
- **AND** MUST NOT 在 capture 阶段以脱敏结果覆盖 canonical `userInput`

### Requirement: 输出压缩器 (B - Output Digest)
系统 MUST 将“助手思考”与“助手正文”分离处理：思考仅存摘要，正文按原文完整保存。

#### Scenario: 思考仅生成摘要
- **GIVEN** assistant 完成时存在可用于总结的思考内容
- **WHEN** 系统构建写入载荷
- **THEN** MUST 仅写入 `assistantThinkingSummary`
- **AND** MUST NOT 持久化完整思考流文本

#### Scenario: 助手正文原文完整保存
- **GIVEN** assistant 返回正文内容
- **WHEN** 系统构建写入载荷
- **THEN** MUST 将正文完整写入 `assistantResponse`
- **AND** MUST NOT 按摘要策略裁剪为短文本

#### Scenario: 工具调用结果不写入正文
- **GIVEN** assistant 轮次中包含工具调用结果
- **WHEN** 系统构建写入载荷
- **THEN** 工具原始大段输出 MUST NOT 写入 `assistantResponse`
- **AND** 仅允许以结构化操作记录形式进入 `operationTrail`

### Requirement: 融合写入 (C - Fusion Write)
系统 MUST 采用“单轮绑定模型 + 幂等键”完成融合写入，并保证操作记录结构统一。

#### Scenario: 单轮绑定写入四段数据
- **GIVEN** 某轮次存在用户输入与 assistant 完成事件
- **WHEN** 系统执行融合写入
- **THEN** MUST 在同一记忆单元中绑定 `userInput/assistantThinkingSummary/assistantResponse/operationTrail`
- **AND** MUST 将该记忆单元与 `turnId/messageId` 关联

#### Scenario: 幂等防重
- **GIVEN** 同一 `workspaceId/threadId/turnId/messageId` 被重复触发完成事件
- **WHEN** 系统执行融合写入
- **THEN** MUST 仅保留一次有效写入结果
- **AND** MUST NOT 产生重复记忆

#### Scenario: 操作记录七字段与状态枚举
- **GIVEN** 系统写入 `operationTrail`
- **WHEN** 任一记录落库
- **THEN** 每条记录 MUST 包含 `actionType/target/status/timestamp/briefResult/durationMs/errorCode` 七字段
- **AND** `status` MUST 仅允许 `success|failed|skipped`
- **AND** `operationTrail` MUST 按时间正序保存且不做同类压缩

#### Scenario: stale pending capture 触发一次恢复
- **GIVEN** capture 已成功且 provisional 记录已创建
- **AND** 同一运行期内未在 stale window 内完成正常 fusion
- **WHEN** 系统执行 pending capture 清理
- **THEN** 系统 MUST 先尝试基于当前 turn 快照恢复一次 fusion
- **AND** 若仍无法恢复最终 assistant 正文，则 MUST 静默移除 provisional 记录

### Requirement: 事件驱动架构
系统 MUST 继续通过消息完成事件触发融合流程，并将事件去重与轮次绑定作为默认保护。

#### Scenario: 完成事件驱动融合
- **GIVEN** assistant 消息完成事件到达
- **WHEN** 事件通过线程事件处理链路转发
- **THEN** 系统 MUST 触发融合写入流程
- **AND** MUST 传递 `threadId/turnId/messageId` 上下文

#### Scenario: 重复事件去重
- **GIVEN** 同一 `messageId` 完成事件被重复分发
- **WHEN** 系统检测到重复
- **THEN** MUST 跳过重复融合执行
- **AND** MUST 保持已写入记忆不变

#### Scenario: 启动时执行 provisional reconciliation
- **GIVEN** 应用上一次运行中遗留未完成 fusion 的 provisional 记录
- **WHEN** 应用启动并初始化 Project Memory V2
- **THEN** 系统 MUST 执行一次 reconciliation
- **AND** 对可恢复的记录补齐 fusion
- **AND** 对不可恢复且无最终 assistant 正文的记录执行静默移除
