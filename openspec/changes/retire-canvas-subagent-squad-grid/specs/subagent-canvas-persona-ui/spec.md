## MODIFIED Requirements

### Requirement: Canvas single card presentation

系统 MUST NOT 在对话主幕布消息流中将 subAgent tool 渲染为 persona 单卡或 Ring 卡。subAgent tool MUST 以普通工具行（Generic tool presentation）呈现以保留审计痕迹。子代理的可点击主列表表面 MUST 是 Composer run-status strip 展开行与/或 StatusPanel 子代理列表（见 `composer-run-status-subagent-surface`）。

#### Scenario: lone agent tool on canvas

- **WHEN** 幕布上出现单个 subAgent tool item
- **THEN** UI MUST NOT 显示 persona 单卡或 SubagentSquadGrid
- **AND** MUST 以普通工具行呈现该 tool item

#### Scenario: inspect still available off-canvas

- **WHEN** 同一会话存在已聚合的 SubagentInfo
- **THEN** 用户 MUST 能从 Composer run-status strip 或 StatusPanel 打开 inspector
- **AND** inspector MUST 仍展示任务描述、status、output/交付报告（无则安全占位）

### Requirement: Canvas squad grid for consecutive subagents

系统 MUST NOT 将时间线上连续的 subAgent tool items 合并为幕布小队网格（`subagentGroup` / `SubagentSquadGrid`）。连续 subAgent tools MUST 各自作为 plain timeline item 呈现。

#### Scenario: consecutive agents do not form a canvas squad

- **WHEN** 连续两个及以上 subAgent tool 相邻
- **THEN** 系统 MUST NOT 渲染幕布小队网格
- **AND** 每项 MUST 保持独立 plain tool 行（或等价 Generic 呈现）

#### Scenario: non-subagent tool no longer defines squad break

- **WHEN** 两个 subAgent tool 之间插入非 subAgent tool
- **THEN** 系统 MUST NOT 产生任何 `subagentGroup` 合并行为（无小队可打断）

### Requirement: Synthetic squad from shared child sessions

当 Shared 父幕布无 subAgent tool 但存在子代理子会话时，系统 MUST NOT 向主幕布注入合成小队卡。子代理可见性 MUST 由 status-panel / Composer run-status 聚合（含子树补齐）承担。嵌套详情幕布 MUST NOT 注入合成卡。

#### Scenario: shared parent without spawn tools

- **WHEN** Shared 父会话投影只有 assistant 正文且存在多个子代理子会话
- **THEN** 幕布 MUST NOT 渲染合成 persona/Ring 小队卡
- **AND** Composer strip 或 StatusPanel MUST 仍能列出这些子代理（当聚合链路有事实时）

#### Scenario: nested detail canvas never re-injects

- **WHEN** 用户打开子代理详情幕布（threadId 为 child）
- **THEN** 详情幕布 MUST NOT 注入父级合成小队

## REMOVED Requirements

### Requirement: Canvas squad grid presentation chrome

~~幕布「N 个助手」标题、分段状态条、环形进度 Ring 卡网格~~ — 由 Composer run-status strip 替代；实现 MUST 删除 `SubagentSquadGrid` / `SubagentRingCard` 及 `squad*` / `statusShort` i18n 键。

## ADDED Requirements

### Requirement: Primary subagent surface is off-canvas

子代理的 **canonical 用户观察面** MUST 是 Composer run-status strip（有子代理时）与 StatusPanel 子代理列表；主幕布 MUST NOT 再作为小队 UI 宿主。

#### Scenario: strip present when subagents exist

- **WHEN** 当前会话聚合到至少 1 个 SubagentInfo
- **THEN** Composer run-status 区域 MUST 可展示子代理 pill（如 completed/total）
- **AND** 用户 MUST 能展开查看行状态并打开 inspector
