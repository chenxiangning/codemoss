## ADDED Requirements

### Requirement: Cold start MUST complete bounded active workspace first-paint without automatic full-catalog

冷启主窗口在存在 active workspace 时，系统 MUST 先调度 `thread/list first-paint hydration`（phase=`active-workspace`，mode=`first-paint`），MUST NOT 在 UI 尚未 first-paint hydrated 时直接对 active workspace 调度 `thread/list full-catalog hydration`。first-paint 完成后 MUST NOT 仅因 settle 自动调度 full-catalog；完整历史由用户显式需求加载。

#### Scenario: active workspace cold start records first-paint task

- **WHEN** 用户冷启桌面客户端且存在 active workspace
- **THEN** startupTrace MUST 包含 `traceLabel` 为 `thread/list first-paint hydration`（或等价 id `thread-list:first-paint:<workspaceId>`）的 task 生命周期
- **AND** 该 task 的 `phase` MUST 为 `active-workspace`
- **AND** 若用户后续显式触发同 workspace 的 full-catalog，该 task MUST 更早 `started`

#### Scenario: full-catalog is not the first list kind for active workspace

- **WHEN** active workspace 的 thread list 尚未完成 first-paint UI hydration
- **THEN** 系统 MUST NOT 以 `kind=full-catalog` 作为该 workspace 冷启第一次 ensure 的 kind
- **AND** MUST NOT 仅因 projection-owner 或旁路 ensure 而跳过 first-paint

#### Scenario: first-paint settle does not automatically enqueue full-catalog

- **WHEN** active workspace first-paint 已完成
- **AND** 用户未触发 Load older、Session Management 或 force refresh
- **THEN** 系统 MUST NOT 仅因 first-paint settle 自动调度 `full-catalog`
- **AND** 完整历史 MUST 由上述显式需求路径按各自 page/window budget 获取

### Requirement: Codex pagination MUST bound underlying scan work

Codex unified listing 的 `cursor + limit` MUST 约束 local JSONL candidate scan 与 live thread page fetch 的真实工作量，MUST NOT 先用 `usize::MAX` 或等价方式完整枚举后再 slice。实现 MAY 使用小幅 lookahead 证明 next page，但该 lookahead MUST 为固定有界常量。

#### Scenario: first page does not parse the full Codex archive

- **WHEN** Sidebar 请求 `cursor=null, limit=5`
- **THEN** local candidate target MUST 基于 `5 + next-page proof + bounded lookahead`
- **AND** candidates MUST 按 recent-first 顺序处理并在达到 unique-session target 后停止
- **AND** 单个 local JSONL preview MUST 使用固定 byte budget，Desktop 与 daemon fallback MUST 遵循同一 preview contract
- **AND** live list MUST NOT 为该请求遍历到全局 5000-thread cap

#### Scenario: later cursor expands only the required bounded prefix

- **WHEN** Sidebar 请求 offset cursor O 与 limit L
- **THEN** scan target MUST 至少覆盖 `O + L` 与 bounded next-page proof
- **AND** MUST NOT 因 O 非零退化为无界全目录扫描

### Requirement: startup-gate-ready MUST only reflect interactive readiness

`startup-gate-ready` milestone MUST 仅表示「允许揭开冷启点击门控 / 进入可交互窗」的产品完成态，其 stamp 原因 MUST 属于：`first-paint-complete`（active workspace first-paint 完成）、`home-input-ready`（无 active list 路径的 home input-ready）、或 `force-enter`。系统 MUST NOT 因 full-catalog `timed-out` / `degraded` / `completed` 而 stamp `startup-gate-ready`。

#### Scenario: full-catalog timeout does not stamp gate-ready

- **WHEN** `thread/list full-catalog hydration` 以 `timeout` 或 `degraded` 结束
- **THEN** 系统 MUST NOT 因此写入 `startup-gate-ready`
- **AND** startupTrace / diagnostic dump MUST 能区分 gate 原因与 full-catalog 结局

#### Scenario: first-paint completion may stamp gate-ready

- **WHEN** active workspace first-paint hydration 成功 settle（completed 或等价 UI hydrated 发布）
- **THEN** 系统 MAY stamp `startup-gate-ready` with reason `first-paint-complete`
- **AND** full-catalog MUST 保持未开始，除非已有明确用户需求触发

#### Scenario: force-enter stamps interactive readiness without requiring full-catalog

- **WHEN** 用户触发 startup force-enter
- **THEN** 系统 MUST 取消任何既有 startup-owned pending full-catalog 并阻止其重入（见 cooldown 要求）
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
