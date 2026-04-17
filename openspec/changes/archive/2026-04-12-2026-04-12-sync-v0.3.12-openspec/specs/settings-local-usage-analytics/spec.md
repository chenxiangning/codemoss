## ADDED Requirements

### Requirement: Usage Statistics MUST Support Multi-Engine Aggregation
系统 MUST 支持 `provider=all` 聚合多引擎会话统计，并支持 `current/all` 作用域切换。

#### Scenario: all-provider mode returns cross-engine sessions
- **WHEN** 用户选择 `provider=all`
- **THEN** 系统 MUST 返回跨引擎会话集合
- **AND** 会话元信息 MUST 保留 `model/source/provider`

### Requirement: Usage Overview MUST Expose Engine Distribution and AI Code Changes
系统 MUST 提供引擎分布与 AI 代码改动指标。

#### Scenario: statistics payload includes engine distribution and code-change metrics
- **WHEN** 系统返回 Usage 统计结果
- **THEN** 结果 MUST 包含 `engineUsage[]` 与 `totalEngineUsageCount`
- **AND** 结果 MUST 包含 `aiCodeModifiedLines` 与 `dailyCodeChanges[]`
