## ADDED Requirements

### Requirement: Stage attempt prompts SHALL honor upstream feed mode

系统在启动非首段 stage attempt 时 MUST 按该段 `upstreamFeedMode` 组装上游产出文本并纳入 worker prompt（审查/中间/通用路径均不得静默丢弃非空上游 notes）。

#### Scenario: implement path also receives upstream notes when present

- **WHEN** 中间段走 plan/implement 基座 prompt 且 prior feed notes 非空
- **THEN** 最终 worker prompt MUST 包含上游产出块
- **AND** 块内容 MUST 符合该段 feed mode（summary 或 full）

#### Scenario: missing mode equals summary

- **WHEN** projection/binding 无 upstreamFeedMode
- **THEN** 行为 MUST 与仅 short_outcome 的历史注入一致
