## ADDED Requirements

### Requirement: Codex History Reopen Keeps Activity Panel Continuity

对于 `Codex` 会话，右侧 `session activity` 面板 MUST 在历史 reopening 场景下保持与实时阶段连续，不得退化为空态。

#### Scenario: historical codex activity panel replays prior visible activity

- **WHEN** 用户重新打开一个在实时阶段已经展示过 `reasoning`、命令或文件修改活动的 `Codex` 会话
- **THEN** 右侧 `session activity` MUST 重放这些已展示活动
- **AND** 面板 MUST NOT 因历史载荷退化而回退到“当前尚无 session activity”空态

#### Scenario: activity panel continuity prefers richer reconstructed facts

- **WHEN** `resumeThread` 与本地历史 replay 同时提供同一 `Codex` 活动的部分信息
- **THEN** 面板数据源 MUST 采用更丰富的事实版本
- **AND** 状态更新、文件路径与命令摘要 MUST 与实时阶段保持语义一致
