## Purpose

协作模板与运行时支持按环节声明「上游喂料」策略：摘要（shortOutcome）或全文（fullOutcome），首段固定用户全文。

## ADDED Requirements

### Requirement: First stage SHALL consume full user task without upstream feed control

系统 MUST 将协作管线首段（stage index 0）的用户任务以全文策略送入 worker（含既有 fan-in），且模板编辑 UI MUST NOT 为该段展示上游摘要/全文开关。

#### Scenario: first stage has no feed toggle

- **WHEN** 用户在模板管理中编辑 stages[0]
- **THEN** UI MUST NOT 显示上游 feed 滑动控件
- **AND** 即便存储中存在 `upstreamFeedMode` 字段，启动首段时 MUST 忽略该字段用于上游拼装

### Requirement: Non-first stages SHALL support summary or full upstream feed mode

系统 MUST 允许 stages[i]（i≥1）配置 `upstreamFeedMode` 为 `summary` 或 `full`，缺省为 `summary`。

#### Scenario: default is summary for backward compatibility

- **WHEN** 模板或 binding 未设置 `upstreamFeedMode`
- **THEN** 启动该段时 MUST 按 summary 行为组装上游（使用前序 short_outcome）

#### Scenario: full mode uses full_outcome with fallback

- **WHEN** 当前段 `upstreamFeedMode` 为 `full` 且存在已成功前序
- **THEN** 上游材料 MUST 优先取各前序 `full_outcome`（非空）
- **AND** 某前序无 full 时 MUST 回退该前序 `short_outcome`
- **AND** 全文 MUST 经既有 body 安全阀截断，禁止无限膨胀

#### Scenario: summary mode uses short_outcome only

- **WHEN** 当前段 mode 为 `summary`
- **THEN** 上游材料 MUST 使用前序 `short_outcome` 拼接（与历史行为一致）

### Requirement: Template editor SHALL expose feed mode for non-first stages

模板管理 MUST 为第 2 个起的环节提供摘要/全文选择并持久化。

#### Scenario: save and reload preserves mode

- **WHEN** 用户将某非首段设为全文并保存模板
- **THEN** 再次打开该模板 MUST 恢复为全文
- **AND** `templateToStageBindings` MUST 将该字段写入 stageBindings

### Requirement: Inspector upstream section SHALL align with feed mode

注入上下文 Header 的上游分区 MUST 按当前段 feed mode 选择 short 或 full 材料（展示层可再 UI clamp）。

#### Scenario: full mode shows longer prior body when available

- **WHEN** 当前段 mode 为 full 且前序 fullOutcome 非空
- **THEN** 上游分区 body MUST 包含该全文（或经展示 cap 的全文前缀），不得仅展示 short 而假装 full
