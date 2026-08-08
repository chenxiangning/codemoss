## ADDED Requirements

### Requirement: Cold start MUST complete active workspace first-paint before full-catalog

冷启主窗口在存在 active workspace 时，系统 MUST 先调度 `thread/list first-paint hydration`（phase=`active-workspace`，mode=`first-paint`），MUST NOT 在 UI 尚未 first-paint hydrated 时直接对 active workspace 调度 `thread/list full-catalog hydration`。first-paint 完成后方可在 idle 预算内调度至多一次自动 full-catalog。

#### Scenario: active workspace cold start records first-paint task

- **WHEN** 用户冷启桌面客户端且存在 active workspace
- **THEN** startupTrace MUST 包含 `traceLabel` 为 `thread/list first-paint hydration`（或等价 id `thread-list:first-paint:<workspaceId>`）的 task 生命周期
- **AND** 该 task 的 `phase` MUST 为 `active-workspace`
- **AND** 该 task MUST 在同 workspace 的自动 full-catalog task 之前 `started`

#### Scenario: full-catalog is not the first list kind for active workspace

- **WHEN** active workspace 的 thread list 尚未完成 first-paint UI hydration
- **THEN** 系统 MUST NOT 以 `kind=full-catalog` 作为该 workspace 冷启第一次 ensure 的 kind
- **AND** MUST NOT 仅因 projection-owner 或旁路 ensure 而跳过 first-paint

#### Scenario: automatic full-catalog runs at most once after first-paint idle

- **WHEN** active workspace first-paint 已完成
- **AND** 用户未 force-enter、未 force refresh
- **THEN** 系统 MUST 至多通过 idle 调度一次自动 `full-catalog` ensure
- **AND** 该调度 MUST 尊重 `scheduleWhenBrowserIdle`（或等价）最小延迟，MUST NOT 在 first-paint finally 内同步立刻 full 扫

### Requirement: startup-gate-ready MUST only reflect interactive readiness

`startup-gate-ready` milestone MUST 仅表示「允许揭开冷启点击门控 / 进入可交互窗」的产品完成态，其 stamp 原因 MUST 属于：`first-paint-complete`（active workspace first-paint 完成）、`home-input-ready`（无 active list 路径的 home input-ready）、或 `force-enter`。系统 MUST NOT 因 full-catalog `timed-out` / `degraded` / `completed` 而 stamp `startup-gate-ready`。

#### Scenario: full-catalog timeout does not stamp gate-ready

- **WHEN** `thread/list full-catalog hydration` 以 `timeout` 或 `degraded` 结束
- **THEN** 系统 MUST NOT 因此写入 `startup-gate-ready`
- **AND** startupTrace / diagnostic dump MUST 能区分 gate 原因与 full-catalog 结局

#### Scenario: first-paint completion may stamp gate-ready

- **WHEN** active workspace first-paint hydration 成功 settle（completed 或等价 UI hydrated 发布）
- **THEN** 系统 MAY stamp `startup-gate-ready` with reason `first-paint-complete`
- **AND** 此时 full-catalog MUST 仍允许在后台继续或尚未开始

#### Scenario: force-enter stamps interactive readiness without requiring full-catalog

- **WHEN** 用户触发 startup force-enter
- **THEN** 系统 MUST 取消 pending idle full-catalog 并阻止其重入（见 cooldown 要求）
- **AND** 交互门控 MUST 可关闭
- **AND** 系统 MUST NOT 要求 full-catalog 已完成

### Requirement: Full-catalog timeout MUST suppress automatic retry

对同一 `dedupeKey`（形如 `thread-list:full-catalog:<workspaceId>`），当 task 以 `timed-out`、`degraded`（timeout/stale/cancelled fallback）或 force-enter 取消 settle 后，系统 MUST 在冷却窗口内（默认 ≥ 60s，常量可配置）忽略自动 ensure 重入。仅用户显式 force refresh / 等价手动刷新 MAY 绕过冷却。

#### Scenario: timeout does not immediately requeue same full-catalog

- **WHEN** workspace W 的 full-catalog task 因 timeout degraded
- **THEN** 随后 60s 内系统 MUST NOT 自动 `started` 同一 `thread-list:full-catalog:W`
- **AND** diagnostic dump MUST 可列出被 cooldown 拦截的 dedupeKey（若实现 dump 字段）

#### Scenario: user force refresh may bypass cooldown

- **WHEN** 用户对 workspace W 触发显式 force thread list reload
- **THEN** 系统 MAY 忽略 full-catalog cooldown 并重新 ensure
- **AND** 该路径 MUST 使用 force 语义并可追踪

### Requirement: Non-active workspaces MUST NOT full-catalog during cold-start window

在冷启窗（定义为：尚未 `startup-gate-ready` 且 active first-paint 未完成的时段，或实现上等价的 cold-start generation）内，系统 MUST NOT 对非 active workspace 调度 `thread/list full-catalog hydration`。非 active 的 full 或 session-radar 仅可在 gate-ready 之后、idle 预算内、或用户切换到该 workspace 时进行。

#### Scenario: two workspaces open does not dual full-catalog at cold start

- **WHEN** 客户端存在 active workspace A 与非 active workspace B
- **AND** 用户冷启应用
- **THEN** 在 A 的 first-paint 完成前，系统 MUST NOT `started` B 的 full-catalog task
- **AND** 不得与 A 的 list 扫描并行启动 B 的 full-catalog

#### Scenario: switching to workspace triggers on-demand ensure

- **WHEN** 用户在 gate-ready 后将 active 切换到尚未 fully hydrated 的 workspace B
- **THEN** 系统 MUST 允许对 B 调度 first-paint 或 full-catalog（按 B 的 hydration 状态）
- **AND** 该调度 MUST 取消或 stale 抑制对已离开 workspace 的过期 apply

### Requirement: First-paint list MUST skip multi-engine heavy subsources

当 `startupHydrationMode === "first-paint"` 时，`listThreadsForWorkspace` MUST 跳过 OpenCode session list、Claude disk seed、project multi-engine catalog、以及 gemini/kimi/grok 冷启刷新等重子源；MUST 仅加载有界 Codex/first-page（或等价主列表页）与 last-good 合并所必需的数据。

#### Scenario: first-paint does not call opencode_session_list

- **WHEN** list 路径以 first-paint 模式运行
- **THEN** 系统 MUST NOT 发起 `opencode_session_list`（或等价 OpenCode 全量枚举）IPC
- **AND** startup command trace MUST 不在 first-paint 任务窗内记录该 command 的成功完成归因于 first-paint

#### Scenario: first-paint still shows last-good sessions when available

- **WHEN** first-paint 运行且本地存在 last-good thread summaries
- **THEN** 侧栏 MUST 能展示 retainable last-good 条目（在现有 seed 规则下）
- **AND** MUST NOT 因跳过重子源而清空已有缓存列表为永久空

### Requirement: Full-catalog OpenCode subsource MUST be budgeted and last-good safe

full-catalog 中的 OpenCode 子源 MUST 受 timeout 预算约束（实现常量，默认方向 ≤ 3s，可调）；timeout 或 rejection MUST seed last-good OpenCode 条目（与 `sidebar-list-timeout-fallback` 一致），且晚到结果在 generation/stale 失效后 MUST NOT apply 到 UI store。

#### Scenario: opencode timeout uses last-good and does not block forever

- **WHEN** full-catalog 中 OpenCode list 超过预算
- **THEN** 该子源 MUST 按 timeout 路径 settle
- **AND** retainable last-good OpenCode 条目 MUST 被保留
- **AND** 列表整体 MUST 仍可对其他子源完成合并（不无限等待 OpenCode）

#### Scenario: stale opencode result after force-enter is dropped

- **WHEN** 用户 force-enter 后 OpenCode IPC 才返回
- **AND** 对应 hydration generation 已 stale
- **THEN** 系统 MUST NOT 用该结果 `setThreads` 覆盖当前侧栏状态
