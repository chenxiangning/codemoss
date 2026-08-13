## ADDED Requirements

### Requirement: Startup diagnostics SHALL provide a compact project-aware vertical timeline

显式启用 `StartupGateOverlay` 并展开加载日志时，系统 SHALL 以单列 vertical timeline 展示 startup 与 runtime 后台工作。timeline MUST 在阅读舒适的前提下采用 adaptive compact density，并 MUST NOT 通过机械强制单行隐藏必要说明。

#### Scenario: Startup and runtime work use one visual reading path

- **WHEN** 用户展开 startup loading diagnostics
- **THEN** 系统 MUST render 一条单列 vertical timeline
- **AND** timeline MUST 明确标识启动阶段与运行阶段
- **AND** 现有并排 `startupTrace` / `runtimeNotice` 双栏 MUST NOT 继续作为主展示形式

#### Scenario: Node density adapts to content

- **WHEN** timeline node 只需要 title、project、count 与 duration 即可表达
- **THEN** node SHOULD 使用单行或紧凑布局
- **AND** 当 semantic description 对理解有价值时 node MUST 允许舒适的第二行
- **AND** warning、error 或复杂说明 MUST NOT 因固定单行限制而变得不可读

#### Scenario: Long diagnostics remain bounded

- **WHEN** timeline 包含大量 startup 或 runtime operation
- **THEN** panel MUST 保持 bounded height 与内部 scrolling
- **AND** safe aggregation MUST reduce repeated visual nodes without deleting raw evidence

### Requirement: Timeline aggregation MUST preserve execution, project, and failure truth

timeline projection MUST only aggregate events whose phase/section、operation identity、workspace/project identity 与 result status compatible。聚合 MUST 显示准确执行次数，并 MUST NOT 把 task lifecycle event 数量误报为 operation execution count。

#### Scenario: Repeated successful operation merges within one project

- **WHEN** 相同 operation 在同一 project 与 compatible phase 内成功执行多次
- **THEN** timeline MUST render 一个聚合节点并显示 `×N`
- **AND** node MUST 显示具有明确语义的 duration summary

#### Scenario: Same operation stays separate across projects

- **WHEN** 相同 operation 分别作用于两个 workspace/project
- **THEN** timeline MUST render project-scoped separate nodes
- **AND** 每个 node MUST 显示对应 project label

#### Scenario: Failure never merges into success

- **WHEN** 相同 operation 同时存在 completed 与 failed、timed-out、degraded 或 cancelled outcome
- **THEN** non-success outcome MUST remain visually distinguishable from completed aggregation
- **AND** success count MUST NOT include non-success executions

#### Scenario: Task lifecycle folds into executions before aggregation

- **WHEN** 一个 task execution 依次产生 queued、started 与 terminal lifecycle events
- **THEN** timeline MUST project that lifecycle as one execution
- **AND** count MUST NOT increase once per lifecycle transition

### Requirement: Timeline nodes SHALL explain operation meaning and workspace scope

每个 timeline node SHALL 提供人类可读的 operation title 与简短含义说明。workspace-scoped node MUST 尽可能显示 project name，并 SHALL 提供完整 workspace path 与 technical identifier 的可访问 detail presentation。

#### Scenario: Known operation receives semantic copy

- **WHEN** technical label 匹配 workspace catalog、thread/session refresh、skills、prompts、commands、collaboration modes、models、Git 或已知 milestone
- **THEN** node MUST 显示说明该后台工作用途的 localized semantic copy
- **AND** copy MUST NOT 编造 source facts 未提供的数量、结果或状态

#### Scenario: Unknown operation uses honest fallback

- **WHEN** technical label 不匹配 semantic registry
- **THEN** node MUST preserve the original technical label
- **AND** description MUST use a generic truthful fallback rather than guessing operation-specific behavior

#### Scenario: Workspace cache resolves project identity

- **WHEN** startup trace workspace id 在现有 sidebar workspace snapshot 中存在
- **THEN** node MUST display non-empty workspace name or path basename as project label
- **AND** detail presentation MUST expose the full workspace path

#### Scenario: Missing workspace cache degrades safely

- **WHEN** sidebar workspace snapshot 缺失、损坏或找不到对应 workspace id
- **THEN** timeline MUST fall back to a stable workspace id label
- **AND** rendering MUST NOT issue a new backend workspace-list request or block diagnostics

#### Scenario: Detail presentation is keyboard accessible

- **WHEN** 用户通过 keyboard focus 或等价触发方式访问 node detail
- **THEN** system MUST expose available path、technical identifier 与 timing breakdown
- **AND** status、count 与 duration MUST NOT depend on color alone

### Requirement: Timeline SHALL preserve clock-domain honesty

startup trace sequence 与 runtime notice wall-clock MUST 保持各自的 ordering contract。系统 MUST NOT 将 `performance.now()` timestamp 与 epoch timestamp 直接混排并声称形成精确 chronology。

#### Scenario: Startup trace keeps trace sequence

- **WHEN** startup nodes are projected
- **THEN** their ordering MUST derive from startup trace sequence or lifecycle folding based on that sequence

#### Scenario: Runtime notices keep wall-clock order

- **WHEN** runtime nodes are projected
- **THEN** their ordering MUST derive from runtime notice timestamp/order
- **AND** startup-mirrored diagnostic notices MUST NOT duplicate startup trace nodes in the runtime section

### Requirement: Visual aggregation MUST NOT change raw diagnostic copy

一键复制诊断包 MUST continue to serialize original startup events、milestones 与 runtime notices，而不是 timeline view model。UI aggregation、semantic copy 与 visual ordering MUST NOT remove、reorder or rewrite raw diagnostic evidence。

#### Scenario: Copy after timeline aggregation retains every raw event

- **WHEN** timeline 将多个 compatible operations 聚合为一个 `×N` node
- **AND** 用户点击一键复制诊断包
- **THEN** copied text MUST still include every original chronological startup trace event
- **AND** runtime notice keys、repeat counts、message params 与 diagnostic ranking sections MUST remain available through the existing raw dump builder

#### Scenario: Timeline refactor does not change control behavior

- **WHEN** timeline presentation replaces the previous dual-column lists
- **THEN** panel expand/collapse、copy feedback、force-enter、auto-close、platform guard 与 test opt-in behavior MUST remain unchanged
