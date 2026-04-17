# project-memory-storage Specification Delta

## MODIFIED Requirements

### Requirement: 分项目文件夹存储结构
系统 MUST 继续按 workspace 与日期组织存储，并在大文件场景下支持同日分片。

#### Scenario: 单日超阈值自动分片
- **GIVEN** 某 workspace 当日记忆文件已达到 60MB
- **WHEN** 系统继续写入当日新记忆
- **THEN** MUST 自动滚动写入 `YYYY-MM-DD.partN.json`
- **AND** MUST NOT 覆盖已存在分片数据

#### Scenario: 同日分片透明聚合读取
- **GIVEN** 同一天存在 `YYYY-MM-DD.json` 与多个 `YYYY-MM-DD.partN.json`
- **WHEN** 系统执行 list/get 读取
- **THEN** MUST 聚合同日所有分片并返回统一结果视图
- **AND** 用户侧 MUST 无需感知分片存在

#### Scenario: 单个损坏分片被隔离
- **GIVEN** 某 workspace 的一个日期分片文件 JSON 已损坏
- **WHEN** 系统执行 list/get/search
- **THEN** 系统 MUST 隔离并跳过该损坏文件
- **AND** MUST 继续返回其余可读分片的数据
- **AND** MUST 将损坏文件写入诊断日志

### Requirement: 脱敏处理
系统 MUST 对 V2 轮次模型执行“字段分级处理”：原文字段直存，其他字段可按既有规则治理。

#### Scenario: 原文字段不做脱敏改写
- **GIVEN** V2 轮次记忆包含 `userInput` 与 `assistantResponse`
- **WHEN** 系统执行持久化写入
- **THEN** 这两个字段 MUST 按原文直存
- **AND** MUST NOT 执行脱敏替换或内容截断

#### Scenario: 操作记录仅保存简要结果
- **GIVEN** `operationTrail` 包含失败或工具调用信息
- **WHEN** 系统写入操作记录
- **THEN** `briefResult` MUST 仅保存简要文本
- **AND** MUST NOT 写入详细错误栈或大段原始工具输出

#### Scenario: 阻塞型存储任务不得卡住命令主链路
- **GIVEN** 系统需要执行大体量 JSON 读写、分片扫描或索引重建
- **WHEN** Rust 后端处理 Project Memory V2 请求
- **THEN** 这些阻塞型任务 MUST 在 blocking worker 中执行
- **AND** MUST NOT 直接阻塞 Tauri 命令主链路

### Requirement: 文件格式与结构
系统 MUST 在存储模型中引入 V2 轮次结构，并保持历史数据“只读兼容、不迁移”策略。

#### Scenario: V2 记录字段完整性
- **GIVEN** 系统写入一条 V2 记忆
- **WHEN** 序列化为 JSON
- **THEN** 记录 MUST 包含 `id/workspaceId/threadId/turnId/messageId/createdAt/updatedAt`
- **AND** MUST 保留元数据字段 `title/kind/importance/tags/source/fingerprint`
- **AND** MUST 支持核心段字段 `userInput/assistantThinkingSummary/assistantResponse`
- **AND** MUST 支持 `operationTrail` 数组及其七字段结构

#### Scenario: 兼容读模型字段不反向覆盖真值
- **GIVEN** 服务层继续对外暴露 `summary`、`detail` 或 `cleanText`
- **WHEN** 系统构建读取结果
- **THEN** 这些字段 MUST 视为兼容读模型或索引字段
- **AND** MUST NOT 作为 `userInput/assistantThinkingSummary/assistantResponse/operationTrail` 的真值来源

#### Scenario: 旧数据不迁移
- **GIVEN** 存储中存在旧版记忆结构
- **WHEN** 系统升级到 V2
- **THEN** 系统 MUST 保留旧数据原文件不迁移
- **AND** MUST 继续允许读取层按需进行兼容解析

#### Scenario: 无法映射新模型的旧记录静默跳过
- **GIVEN** 某旧记录无法映射到 V2 展示字段集合
- **WHEN** 系统执行展示读取
- **THEN** 该记录 MUST 被静默跳过
- **AND** MUST NOT 生成占位项或用户可见告警
