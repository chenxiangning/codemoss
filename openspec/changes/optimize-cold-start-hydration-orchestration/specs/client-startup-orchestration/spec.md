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

### Requirement: Performance diagnostics MUST NOT amplify cold-start stalls

高频 frame sampling MUST 使用有界 memory-first retention，MUST NOT 每个 sample 触发 durable client-store write。durable diagnostics MUST 有 byte budget 与低频 batch window；由 diagnostics persistence 自身引起的 frame drop MUST NOT 再生成 durable frame-drop evidence。

#### Scenario: warn frame drop remains exportable without disk write

- **WHEN** rAF monitor 捕获普通 warn frame drop
- **THEN** Settings live/export surface MUST 能读取该 sample
- **AND** 该 sample MUST NOT 单独触发 `client_store_patch`

#### Scenario: diagnostics-owned severe frame cannot form feedback loop

- **WHEN** severe frame 的 recent hotspot 包含 renderer diagnostics persist 或 diagnostics client-store write
- **THEN** frame evidence MUST 仅保留在 volatile ring
- **AND** MUST NOT 因该 evidence 再 enqueue durable diagnostics write

#### Scenario: durable renderer diagnostics stay byte-bounded

- **WHEN** legacy/current diagnostics 条目数量与 payload 增长
- **THEN** 下一次 canonical persist MUST 将 renderer lifecycle payload 收敛到 configured byte budget
- **AND** actionable entries SHOULD 比同龄 non-actionable entries 更晚被淘汰

### Requirement: Startup diagnostics MUST use one canonical channel and bounded rendering

`startupTrace` MUST 是正常 startup lifecycle 的 canonical fact channel。started/completed/cancelled task、successful command 与 milestone MUST NOT 再镜像到 `globalRuntimeNotices`；failed/timed-out/degraded task 与 failed command MAY 进入 notice 以保留异常证据。StartupGate compact summary MUST 以最多 1Hz 的 pull snapshot 更新，不得订阅 event cadence 重建整条 timeline。

#### Scenario: normal startup chatter is not double-published

- **WHEN** startup task 发布 queued/started/completed、successful command 或 milestone
- **THEN** fact MUST 存在于 `startupTrace`
- **AND** runtime notice store MUST NOT 新增该正常 fact 的镜像
- **AND** abnormal task / command evidence MUST 仍可进入 runtime notice

#### Scenario: expanding loading logs during the first second freezes a click snapshot

- **WHEN** StartupGate 可见后 1s 内用户展开加载日志
- **THEN** Overlay MUST 复制点击瞬间的 trace/notice snapshot
- **AND** 展开期间后续 live events MUST NOT 触发 timeline 重投影
- **AND** 收起再展开 MUST 获取新的 snapshot
- **AND** overlay MUST NOT 调用 `scrollIntoView()` 或应用 full-window `backdrop-filter`
- **AND** 用户点击 copy 时 MUST 按需读取 latest diagnostic stores
- **AND** manual force-enter 语义 MUST 保持不变

### Requirement: StartupGate loading MUST remain manual-only

StartupGate MUST NOT 因 `startup-gate-ready`、`input-ready`、最短展示时长或 absolute timeout 自动隐藏。milestone 只提供诊断与编排事实；遮罩只允许由用户显式点击 force-enter 关闭。

#### Scenario: ready milestone does not auto-hide loading

- **WHEN** `startup-gate-ready` 已记录
- **AND** elapsed 已超过 legacy 20s ceiling
- **THEN** StartupGate MUST 仍保持可见
- **AND** 系统 MUST NOT 自动调用 force-enter 或取消 startup tasks
- **AND** 用户点击 force-enter 后 MAY 关闭遮罩并 stale-cancel startup-owned tasks

### Requirement: Input readiness MUST NOT wait for redundant current refresh work

冷启的 `input-ready` MUST 表示 renderer 已有可用 app settings 与 workspace state。若 sidebar cache 已提供 workspace state，current `list_workspaces` refresh MUST NOT 成为 hard barrier；无 cache 时 MAY 等待首轮 read settle。catalog tasks MUST 保持既有 domain phase/resource policy，不得通过 shared global queue 串行化并推迟 input readiness。React StrictMode 重放 mount effect 时，`get_app_settings` 与 `list_workspaces` 的首轮请求 MUST 复用同一 in-flight Promise。

#### Scenario: cached workspace readiness does not wait for refresh

- **WHEN** shell mount 时 sidebar cache 已提供可用 workspace state
- **THEN** `input-ready` MUST NOT 等待 current `list_workspaces` refresh settle
- **AND** refresh MAY 独立完成并由当前 active effect owner commit
- **AND** catalog work MUST NOT 由一个 shared global resource barrier 统一后移

#### Scenario: empty cache waits for one bounded initial read

- **WHEN** shell mount 时没有可用 workspace cache
- **THEN** `input-ready` MAY 等待首轮 `list_workspaces` settle
- **AND** StrictMode replay MUST NOT 发起第二个等价 request

#### Scenario: StrictMode does not duplicate input-critical reads

- **WHEN** React StrictMode 对 settings / workspaces mount effect 执行 setup → cleanup → setup
- **THEN** `get_app_settings` MUST 只发起一次首轮 IPC
- **AND** `list_workspaces` MUST 只发起一次首轮 IPC
- **AND** 仅当前 active effect owner MAY commit state / toast / loading settlement

#### Scenario: identity uiScale stays purely web

- **WHEN** 冷启应用 `uiScale=1` 或先执行 identity reset
- **THEN** renderer MUST 只清理 / 应用 CSS scale state
- **AND** MUST NOT 调用 WebView `setZoom(1)`

## MODIFIED Requirements

### Requirement: Startup orchestration SHALL separate critical loading from opportunistic prewarm

The client SHALL keep the critical startup path limited to data needed to render and operate the initial shell, while opportunistic preloads SHALL run only after first paint, during idle time, or after explicit user demand. Active workspace thread list hydration SHALL use a bounded first-paint pass; full-catalog multi-engine merge SHALL require explicit product demand.

#### Scenario: critical path contains only shell prerequisites

- **WHEN** startup begins
- **THEN** the critical path SHALL include client store preload, app settings, workspace list, shell render readiness, and active workspace minimal state only
- **AND** heavy workspace scans SHALL be excluded from that path

#### Scenario: active workspace hydration is bounded

- **WHEN** the active workspace is hydrated after first paint eligibility
- **THEN** the client SHALL first load only bounded first-page thread/session data and last-good merge required for the current workspace（first-paint mode）
- **AND** full history scans or complete multi-engine catalog merges SHALL be deferred to Load older, Session Management, on-demand force, or an equivalent explicit product action
- **AND** automatic full-catalog SHALL NOT run for non-active workspaces during the cold-start window

#### Scenario: idle prewarm stays interruptible

- **WHEN** idle prewarm is running and the user switches active workspace or starts a foreground action
- **THEN** interruptible idle tasks SHALL yield, cancel, or downgrade according to their `cancelPolicy`
- **AND** foreground active workspace work SHALL receive priority
- **AND** force-enter SHALL cancel any startup-owned pending full-catalog and suppress automatic requeue per cooldown
