## ADDED Requirements

### Requirement: Cold-start interactive milestone MUST NOT be stamped by full-catalog settle

Startup orchestration MUST 将 `startup-gate-ready`（若使用）与 full-catalog 任务的 completed/timed-out/degraded settle 解耦。full-catalog 的 finally/settle 路径 MUST NOT 调用 `recordStartupMilestone("startup-gate-ready")`。Gate 完成态 MUST 仅由 first-paint 完成、home 路径 input-ready、或 force-enter 协调逻辑 stamp。

#### Scenario: full-catalog finally does not record gate-ready

- **WHEN** `thread/list full-catalog hydration` 任务 settle（无论 completed 或 timeout）
- **THEN** 该 settle 路径 MUST NOT 新增 `startup-gate-ready` milestone
- **AND** 若此前尚无 gate-ready，系统 MUST 保持未 stamp，直到 first-paint/home/force 条件满足

#### Scenario: first-paint path remains eligible to record gate-ready

- **WHEN** active workspace first-paint hydration 成功发布 UI hydrated
- **THEN** 系统 MAY 记录 `startup-gate-ready`
- **AND** 后续 full-catalog 进行中 MUST NOT 清除该 milestone

### Requirement: Heavy thread-session-scan MUST enforce single in-flight list per workspace kind

对同一 workspace 与同一 list kind（first-paint 或 full-catalog），系统 MUST 通过 orchestrator `dedupeKey` 保证至多一个 in-flight task；冷启路径 MUST NOT 绕过 orchestrator 直接并发调用等价 `list_threads` 全量扫描。timeout 后的自动重入 MUST 遵守 full-catalog cooldown（见 `cold-start-thread-hydration-contract`）。

#### Scenario: duplicate ensure joins in-flight full-catalog

- **WHEN** workspace W 的 full-catalog 已 started
- **AND** 另一 ensure 请求相同 dedupeKey
- **THEN** 系统 MUST 复用 in-flight Promise，不得并行启动第二个等价 full-catalog run

#### Scenario: cold-start list calls go through orchestrator

- **WHEN** 冷启触发 thread list hydration
- **THEN** 对应 task MUST 出现在 startupTrace 且带 `commandLabel`/`traceLabel`
- **AND** MUST NOT 存在无 trace 的旁路重复 list 扫描作为冷启主路径

### Requirement: Cold-start git and catalog prewarm MUST yield to first-paint list

在 active workspace first-paint 完成前，系统 MUST NOT 在 critical/first-paint 阶段启动 `get_git_diffs` 预加载；`get_git_status` 若需要，MUST 有界且 MUST NOT 触发 diffs 风暴。skills / model catalog / engine models 的 opportunistic 加载 MUST 在 shell interactive 之后，且 MUST NOT 阻塞 first-paint list 的调度优先级。

#### Scenario: git diffs stay out of first-paint window

- **WHEN** 冷启且 Git diff 面板不可见
- **THEN** 在 first-paint list 完成前系统 MUST NOT 将 `get_git_diffs` 作为冷启必跑任务
- **AND** command cost rank 在 first-paint 完成前 MUST NOT 以多秒级 diffs 为主路径阻塞项（实现以调度禁止为准）

#### Scenario: skills timeout does not block first-paint scheduling

- **WHEN** skills_list 在 idle-prewarm 超时 degraded
- **THEN** active workspace first-paint / full-catalog 调度 MUST 仍可进行
- **AND** skills MUST NOT 以无限重试抢占 `thread-session-scan` 槽位

### Requirement: Startup diagnostic dump MUST expose gate reason and first-paint presence

当客户端提供冷启 diagnostic dump（如 StartupGate 一键复制）时，dump MUST 包含：`firstPaintPresent`（或可从 events 判定的 first-paint task 列表）、`gateReadyReason`（`first-paint-complete` | `home-input-ready` | `force-enter` | `null`）、command cost rank、以及 full-catalog cooldown 拦截摘要（若有）。

#### Scenario: dump shows missing first-paint as detectable

- **WHEN** 冷启错误地跳过 first-paint
- **THEN** dump / events 检查 MUST 能判定 `firstPaintPresent=false`
- **AND** 该状态 MUST 视为本 change 验收失败条件

## MODIFIED Requirements

### Requirement: Startup orchestration SHALL separate critical loading from opportunistic prewarm

The client SHALL keep the critical startup path limited to data needed to render and operate the initial shell, while opportunistic preloads SHALL run only after first paint, during idle time, or after explicit user demand. Active workspace thread list hydration SHALL use a bounded first-paint pass before any automatic full-catalog multi-engine merge.

#### Scenario: critical path contains only shell prerequisites

- **WHEN** startup begins
- **THEN** the critical path SHALL include client store preload, app settings, workspace list, shell render readiness, and active workspace minimal state only
- **AND** heavy workspace scans SHALL be excluded from that path

#### Scenario: active workspace hydration is bounded

- **WHEN** the active workspace is hydrated after first paint eligibility
- **THEN** the client SHALL first load only bounded first-page thread/session data and last-good merge required for the current workspace（first-paint mode）
- **AND** full history scans or complete multi-engine catalog merges SHALL be deferred to idle full-catalog or on-demand force
- **AND** automatic full-catalog SHALL NOT run for non-active workspaces during the cold-start window

#### Scenario: idle prewarm stays interruptible

- **WHEN** idle prewarm is running and the user switches active workspace or starts a foreground action
- **THEN** interruptible idle tasks SHALL yield, cancel, or downgrade according to their `cancelPolicy`
- **AND** foreground active workspace work SHALL receive priority
- **AND** force-enter SHALL cancel pending idle full-catalog and suppress automatic requeue per cooldown
