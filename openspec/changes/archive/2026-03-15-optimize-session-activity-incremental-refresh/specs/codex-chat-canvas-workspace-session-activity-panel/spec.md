# codex-chat-canvas-workspace-session-activity-panel Specification

MODIFIED by change: optimize-session-activity-incremental-refresh

## MODIFIED Requirements

### Requirement: Multi-Session Timeline Coverage

面板 MUST 以统一时间线作为默认主视图，并聚合至少三类核心活动：命令执行、任务推进、文件修改；`explore` 与 `reasoning` 若展示，MUST 作为独立分类存在。

#### Scenario: explore and reasoning stay visible without polluting executable categories

- **WHEN** 系统收到 `explore` 或 `reasoning` 事件
- **THEN** activity panel MAY 将其展示为独立 timeline event
- **AND** 这些事件 MUST 使用独立分类，而不是伪装成 `command`、`task` 或 `fileChange`
- **AND** `command / task / fileChange / explore / reasoning` 的统计与筛选 MUST 各自独立
- **AND** `reasoning` MUST NOT 改变 `command / task / fileChange` 作为默认扫描主体的事实

### Requirement: Realtime Incremental Refresh

activity panel MUST 随相关 session 的实时状态增量刷新，而不是在每次轻微状态变化时全量重建全部相关 timeline 数据。

#### Scenario: unchanged threads do not force full timeline replay

- **GIVEN** 当前 active thread root subtree 下存在多个相关 threads
- **AND** 本次实时更新仅影响其中一个 thread
- **WHEN** 系统刷新 activity panel
- **THEN** 系统 SHOULD 仅重建发生变化的 thread activity
- **AND** 未变化 threads 的历史 events SHOULD 复用既有结果，而不是整体重放

#### Scenario: running command updates status without duplicating event identity

- **WHEN** 相关 session 中某个命令从 running 切换为 completed 或 failed
- **THEN** activity panel MUST 复用同一条事件身份更新状态
- **AND** MUST NOT 因状态切换重新插入一条新的历史命令事件

### Requirement: Stable Timeline Scanning At Large Event Counts

activity panel 在大 timeline 场景下 MUST 保持稳定可扫描，不能因旧事件过多而压垮当前回合的可读性。

#### Scenario: latest turn stays expanded while older turns stay collapsed by default

- **GIVEN** 当前 timeline 已存在多个 turn groups
- **WHEN** 用户打开 activity panel 或有新的最新 turn 到来
- **THEN** 最新 turn group MUST 默认展开
- **AND** 较早的 turn groups MUST 默认折叠，除非用户手动展开

#### Scenario: turn group folding survives realtime refresh

- **WHEN** activity panel 在运行中持续接收新的 events
- **THEN** 系统 MUST 维持用户已手动切换过的 turn group 折叠状态
- **AND** MUST NOT 因增量刷新把所有历史 turn groups 重新展开
