# project-memory-local-semantic-retrieval Specification (delta)

## Purpose

明确 **Memory Pick Gate** 必须接入本地语义/hybrid 检索能力，与 Scout 同源合同，禁止 Pick 路径长期停留在未接线词面孤岛。

## ADDED Requirements

### Requirement: Pick Gate 必须使用本地语义检索合同

系统 MUST 使 Memory Pick Gate 候选召回遵守本 capability 的本地语义检索与 hybrid 规则（含不可用时回退 lexical）。

#### Scenario: Pick 路径无 provider 时回退 lexical

- **GIVEN** 当前客户端没有可用的本地 embedding provider
- **WHEN** Memory Pick Gate 执行检索
- **THEN** semantic retrieval status SHALL 为 `unavailable`（或等价 diagnostics）
- **AND** 系统 SHALL 执行 lexical retrieval
- **AND** 系统 MUST NOT 使用 fake/test provider 或 lexical 分数伪装 semantic candidate

#### Scenario: Pick 路径 provider 可用时参与 hybrid

- **GIVEN** 本地 embedding provider health 为 available
- **AND** workspace 存在可索引记忆
- **WHEN** Memory Pick Gate 对用户 query 检索
- **THEN** 系统 SHALL 尝试语义信号参与候选排序
- **AND** 成功参与时 retrievalMode SHALL 为 `hybrid` 或 `semantic`
- **AND** 主会话 payload MUST NOT 包含 embedding vector 或内部 vector 明细

#### Scenario: Pick 与 Scout 共享 provider 检测诚实性

- **WHEN** 同一时刻 Scout 与 Pick 查询同一 workspace
- **THEN** 对「provider 是否 available」的判定规则 SHALL 一致
- **AND** 任一侧 MUST NOT 在 provider 不可用时报告 hybrid

### Requirement: 检索 diagnostics 供闸门与埋点

系统 MUST 为消费检索输出可供闸门与 telemetry 使用的 diagnostics（mode、fallback、扫描量、候选量），且 MUST NOT 将完整私密记忆正文写入 diagnostics 日志。

#### Scenario: diagnostics 字段最小集

- **WHEN** 完成一次 Pick 或 Scout 检索
- **THEN** diagnostics SHALL 包含 retrievalMode
- **AND** SHALL 包含候选数量
- **AND** SHALL 在语义不可用或失败时包含 fallback 原因类信息

#### Scenario: 日志隐私

- **WHEN** 系统记录语义/hybrid 检索诊断
- **THEN** 日志 SHALL NOT 输出完整 userInput、assistantResponse 或记忆 detail 全文
