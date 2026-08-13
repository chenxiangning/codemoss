# project-memory-consumption Specification (delta)

## Purpose

强化消费侧检索与注入：Pick/Scout 同核 hybrid-capable；失败可感；注入服务用户当前原文。  
**不修改**自动采集（对话结束写入）要求。

## ADDED Requirements

### Requirement: 消费检索核统一

系统 MUST 为 Memory Pick Gate 与 Memory Scout 消费路径提供统一的 hybrid-capable 检索能力（共享实现或共享算法契约），避免 Pick 孤岛词面检索与 Scout 行为长期分叉。

#### Scenario: Pick 与 Scout 模式语义一致

- **WHEN** 同一 workspace、同一 query、同一 provider 状态下分别走 Pick 检索与 Scout 检索
- **THEN** 两者的 retrievalMode 报告规则 SHALL 一致（无 provider 均为 lexical；有 provider 且语义参与时均为 hybrid 或 semantic）
- **AND** 不得出现一侧报告 hybrid、另一侧在相同条件下伪装 semantic 的不一致

#### Scenario: 消费失败不阻塞主发送

- **WHEN** 消费检索超时或失败
- **THEN** 系统 SHALL 发送用户原始文本（可 0 注入）
- **AND** SHALL NOT 因消费检索失败取消用户发送意图

### Requirement: 注入服务用户当前原文

系统 MUST 将注入的项目记忆定位为**用户当前发送原文的参考上下文**，而非替代用户请求本身。

#### Scenario: 模型侧载荷保留用户原文为任务主体

- **WHEN** 系统构建并发送带 Retrieval Pack 的 model-facing 文本
- **THEN** 用户当前原文 SHALL 位于 pack 块之后（或合同规定的等价结构）
- **AND** pack 内 Instruction SHALL 声明 Primary task 为该用户原文
- **AND** Instruction SHALL 声明记忆为 prior reference only

#### Scenario: 用户可见气泡仍是原文

- **WHEN** 时间线渲染本轮用户消息
- **THEN** 用户气泡 SHALL 只显示用户真实输入
- **AND** 记忆引用 SHALL 作为独立关联资源展示（既有合同）

### Requirement: 采集与消费解耦（零回归）

系统 MUST 保持对话结束后的项目记忆自动采集链路独立于本 change 的消费检索升级。

#### Scenario: 消费检索变更不改采集契约

- **WHEN** 本 change 升级 hybrid 检索或 Pack Instruction
- **THEN** 系统 SHALL NOT 改变 `captureTurnInput` / `completeTurnMemory`（或等价 facade）的对外契约与成功完成条件
- **AND** 助手回合正常完成时 SHALL 仍可按既有设置写入/更新项目记忆

## MODIFIED Requirements

### Requirement: 相关性检索

系统 MUST 基于关键词匹配，并在本地 embedding provider 可用时结合语义信号计算记忆相关性，避免注入不相关记忆造成噪声干扰。

#### Scenario: 关键词归一化

- **GIVEN** 用户 query 为 "数据库优化?"
- **WHEN** 执行关键词归一化
- **THEN** 应转小写、去标点、去停用词
- **AND** 提取关键词 ["数据库", "优化"]

#### Scenario: 计算 overlap score

- **GIVEN** 用户 query 关键词为 ["数据库", "优化"]
- **AND** 记忆 summary 包含 ["数据库", "连接池", "优化"]
- **WHEN** 计算相关性分数
- **THEN** score = hitTerms / queryTerms = 2 / 2 = 1.0

#### Scenario: 相关性阈值过滤

- **GIVEN** 相关性阈值为 0.2
- **AND** 某条记忆的 score = 0.1
- **WHEN** 筛选候选记忆
- **THEN** 应过滤掉该记忆
- **AND** 不应注入到消息中

#### Scenario: 全量低于阈值则不注入

- **GIVEN** 所有记忆的 score 均 < 0.2
- **WHEN** 执行相关性筛选
- **THEN** 应返回空列表
- **AND** 不注入任何记忆到消息

#### Scenario: provider 可用时 hybrid 排序

- **GIVEN** 本地 embedding provider 可用
- **WHEN** 执行消费检索
- **THEN** 系统 SHALL 在 lexical 候选基础上合并 semantic 信号并排序
- **AND** retrievalMode SHALL 反映实际使用的信号（hybrid 或 semantic）

#### Scenario: provider 不可用时 lexical 不伪装

- **GIVEN** 本地 embedding provider 不可用
- **WHEN** 执行消费检索
- **THEN** 系统 SHALL 仅使用 lexical 路径
- **AND** retrievalMode SHALL 为 `lexical`
