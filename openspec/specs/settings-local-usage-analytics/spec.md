# settings-local-usage-analytics Specification

## Purpose

定义设置页本地 Usage 统计能力的行为契约，覆盖多引擎聚合、引擎分布、AI 改动行数与按天趋势展示，确保跨引擎统计口径一致且可追踪。

## Requirements

### Requirement: Usage Statistics MUST Support Multi-Engine Aggregation

系统 MUST 支持按 `provider=all` 聚合 Codex / Claude / Gemini 本地会话统计，并允许 `current/all` 作用域切换。

#### Scenario: all-provider aggregation returns mixed-engine sessions

- **WHEN** 用户在 Usage 面板选择聚合口径（`provider=all`）
- **THEN** 系统 MUST 返回跨引擎会话集合
- **AND** 返回结果 MUST 保留会话级 `model/source/provider` 元信息用于后续分组

#### Scenario: scope switch changes workspace filter semantics deterministically

- **WHEN** 用户在 `current` 与 `all` 作用域之间切换
- **THEN** `current` 模式 MUST 仅统计当前工作区
- **AND** `all` 模式 MUST 统计所有可见工作区

### Requirement: Usage Overview MUST Expose Engine Distribution and AI Code-Change Metrics

Usage 面板 MUST 提供引擎分布与 AI 改动行数指标，支持跨引擎趋势观察。

#### Scenario: engine distribution is available in statistics payload

- **WHEN** 系统返回统计结果
- **THEN** 结果 MUST 包含 `engineUsage[]` 与 `totalEngineUsageCount`
- **AND** 前端 MUST 能基于该字段渲染引擎占比视图

#### Scenario: ai-modified-lines metrics are tracked per-day and in total

- **WHEN** 会话数据包含文件改动信息
- **THEN** 结果 MUST 包含总量 `aiCodeModifiedLines`
- **AND** 结果 MUST 包含按天明细 `dailyCodeChanges[]`

### Requirement: Usage Session List MUST Stay Recoverable Under Partial Source Availability

当单一来源扫描受限时，统计视图 MUST 保持可用并尽可能返回其余来源数据。

#### Scenario: one provider scan fails but others still render

- **WHEN** 某引擎本地扫描链路暂时不可用
- **THEN** 系统 SHOULD 继续返回其它引擎可用统计结果
- **AND** 前端面板 MUST 保持可交互，不得整体崩溃

#### Scenario: date range filter remains deterministic

- **WHEN** 用户切换 `7d/30d/all` 时间范围
- **THEN** 会话、按天 usage、按天 code changes 的过滤边界 MUST 使用同一时间窗口规则
- **AND** 同一输入下重复查询 MUST 返回一致结果
