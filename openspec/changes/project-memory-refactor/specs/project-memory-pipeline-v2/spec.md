# project-memory-pipeline-v2 Specification Delta

## ADDED Requirements

### Requirement: V2 Pipeline 分层契约
系统 MUST 以模块化分层实现 Project Memory V2，并通过统一 Facade 对外提供能力。

#### Scenario: 统一模块边界
- **WHEN** 系统初始化 V2 能力
- **THEN** MUST 形成 `MemoryCapture/MemoryFusion/MemoryStore/MemorySearch/MemoryView/PlatformAdapter` 六层职责边界
- **AND** 业务调用 SHOULD 通过统一 Facade 接入
- **AND** MUST NOT 在业务层散落跨模块文件存储细节

### Requirement: Turn-Bound Memory Unit
系统 MUST 以“单轮绑定”作为 V2 的最小记忆单元。

#### Scenario: 单轮四段绑定
- **GIVEN** 某轮次问答完成
- **WHEN** 系统写入 V2 记忆
- **THEN** MUST 在同一记忆单元绑定 `userInput/assistantThinkingSummary/assistantResponse/operationTrail`
- **AND** MUST 关联 `turnId/messageId`

#### Scenario: 操作记录结构标准化
- **GIVEN** 系统写入 `operationTrail`
- **WHEN** 任一操作记录入库
- **THEN** MUST 包含 `actionType/target/status/timestamp/briefResult/durationMs/errorCode` 七字段
- **AND** `status` MUST 仅允许 `success|failed|skipped`

### Requirement: Fusion SHALL Reconstruct Turn Snapshot Before Persisting
系统 MUST 在 fusion 阶段先解析当前 turn 快照，再生成完整的 V2 记忆单元。

#### Scenario: 从 turn 快照恢复 reasoning 与操作记录
- **GIVEN** assistant completed 回调仅提供最终文本
- **WHEN** 系统执行 V2 fusion
- **THEN** 系统 MUST 从当前 thread 状态或标准化 thread items 中恢复当前 turn 快照
- **AND** MUST 从快照中提取 `assistantThinkingSummary`
- **AND** MUST 从 command/tool/file-change/plan 类 item 中构建 `operationTrail`

#### Scenario: 快照缺失时降级写入
- **GIVEN** 当前 turn 快照缺失或不完整
- **WHEN** 系统执行 V2 fusion
- **THEN** 系统 MUST 退化为仅写入可确认的 `userInput` 与 `assistantResponse`
- **AND** MUST NOT 因快照缺失阻塞主对话链路

### Requirement: OperationTrail Mapping SHALL Be Deterministic Across Engines
系统 MUST 以统一映射矩阵将各引擎 turn items 归一化为 `operationTrail`。

#### Scenario: command execution 映射为 command
- **GIVEN** 当前 turn 快照中存在 `commandExecution` 项
- **WHEN** 系统构建 `operationTrail`
- **THEN** 对应记录 MUST 映射为 `actionType=command`

#### Scenario: file change 映射为 file_write
- **GIVEN** 当前 turn 快照中存在 `fileChange` 项或由 `write/edit/apply_patch` 推导出的文件改动
- **WHEN** 系统构建 `operationTrail`
- **THEN** 对应记录 MUST 映射为 `actionType=file_write`

#### Scenario: readonly tool 映射为 file_read
- **GIVEN** 当前 turn 快照中存在 `read/open/list/search/grep/symbols` 类只读工具项
- **WHEN** 系统构建 `operationTrail`
- **THEN** 对应记录 MUST 映射为 `actionType=file_read`

#### Scenario: plan item 映射为 plan_update
- **GIVEN** 当前 turn 快照中存在 `plan/proposed-plan/plan-implementation` 项
- **WHEN** 系统构建 `operationTrail`
- **THEN** 对应记录 MUST 映射为 `actionType=plan_update`

#### Scenario: 状态与错误码映射稳定
- **GIVEN** 当前操作项的原始状态为 timeout、permission denied、tool error、user cancelled 或 no-op
- **WHEN** 系统构建 `operationTrail`
- **THEN** timeout、permission denied、tool error MUST 映射为 `status=failed`
- **AND** user cancelled 与 explicit no-op MUST 映射为 `status=skipped`
- **AND** `errorCode` MUST 与原始原因保持一致

### Requirement: 删除语义与空壳治理
系统 MUST 对段落级删除与操作级删除提供一致的“确认后即生效”语义。

#### Scenario: 删除二次确认与不可撤销
- **WHEN** 用户删除核心段、单条操作记录或整条记忆
- **THEN** 系统 MUST 提供二次确认
- **AND** 确认后 MUST 立即生效
- **AND** MUST NOT 提供 Undo

#### Scenario: 空壳自动回收
- **GIVEN** 某记忆在删除后已无任何有效核心段且无操作记录
- **WHEN** 系统完成删除写入
- **THEN** MUST 静默删除整条记忆
- **AND** MUST NOT 保留空壳数据

### Requirement: V2 直切与 V1 弃用
系统 MUST 直接切换到 V2 路径，并明确停止 V1 演进。

#### Scenario: 发布后主流程仅命中 V2
- **WHEN** 用户在客户端进行记忆采集、浏览、删除、复制
- **THEN** 主流程 MUST 命中 V2 路径
- **AND** MUST NOT 依赖 V1 逻辑提供新行为

#### Scenario: 无灰度直切
- **WHEN** V2 发布
- **THEN** 系统 MUST 直接启用 V2
- **AND** MUST NOT 依赖灰度开关分批放量

### Requirement: 跨平台一致性与性能基线
系统 MUST 保证 Win/mac 一致行为，并满足已定义性能指标。

#### Scenario: PlatformAdapter 统一平台差异
- **GIVEN** 系统在 Windows 或 macOS 运行
- **WHEN** 执行路径处理、换行处理、文件读写
- **THEN** 平台差异 MUST 通过 `PlatformAdapter` 封装
- **AND** 上层业务行为 MUST 保持一致

#### Scenario: 启动预热与性能门槛
- **WHEN** 应用启动并加载 Project Memory V2
- **THEN** 系统 MUST 自动执行一次索引预热
- **AND** MUST 满足 `列表首屏 P95<=300ms`
- **AND** MUST 满足 `详情打开 P95<=200ms`
- **AND** MUST 满足 `1k 条搜索 P95<=500ms`

#### Scenario: 启动后台任务不得阻塞主链路
- **GIVEN** 应用启动后需要执行 provisional reconciliation 与索引预热
- **WHEN** 用户打开线程或发送首条消息
- **THEN** 后台任务 MUST 在后台执行
- **AND** MUST NOT 阻塞首屏渲染、线程打开或主对话发送

#### Scenario: 阻塞型 memory 任务在后台 worker 执行
- **GIVEN** 系统需要执行大体量 JSON 读写、分片扫描或索引重建
- **WHEN** Project Memory V2 处理 Tauri 命令
- **THEN** 阻塞任务 MUST 迁移到 Rust blocking worker
- **AND** MUST NOT 直接占用命令主链路
