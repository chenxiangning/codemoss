# codex-chat-canvas-workspace-session-activity-panel Specification

ADDED by change: add-current-session-activity-panel

## Purpose

为 chat canvas 右侧区域提供一个 workspace 级多 session 实时活动监控面板，聚合当前任务上下文中的主 session 与派生子 session，减少用户在幕布、status panel、runtime console 之间来回切换。

## ADDED Requirements

### Requirement: Right Panel Workspace Session Activity Entry

系统 MUST 在右侧 panel 体系中提供独立的 workspace session activity 入口。

#### Scenario: right panel exposes activity tab alongside existing panels

- **WHEN** 用户进入支持 chat canvas 的 workspace
- **THEN** 右侧区域 MUST 提供独立的 `activity` 面板入口或等效命名入口
- **AND** 该入口 MUST 与 Git、Files、Search、Memory 等现有 panel 并列存在

#### Scenario: adding activity panel does not replace existing right-side capabilities

- **WHEN** 新增 activity panel 后
- **THEN** Git、Files、Search、Memory 等现有 panel MUST 保持原有访问方式与核心行为
- **AND** activity panel MUST NOT 取代 runtime console 或消息区工具卡片

#### Scenario: solo mode entry is explicit when used as container

- **WHEN** 产品使用 `SOLO` 视图模式承载 activity 监控
- **THEN** 系统 MUST 提供显式进入入口，例如按钮或等效显式操作
- **AND** 系统 MUST NOT 因 session 进入运行态就自动强制切入 `SOLO`

### Requirement: Relevant Session Scope Is Root-Subtree Bound

系统 MUST 仅聚合当前 active thread 所在 root thread 及其 descendants，且这些线程必须属于当前 workspace。

#### Scenario: panel aggregates root thread subtree for current task context

- **GIVEN** 当前 workspace 中存在 active thread
- **WHEN** 系统构建 activity panel 数据
- **THEN** 系统 MUST 先沿 `threadParentById` 向上解析 root thread
- **AND** MUST 仅聚合该 root thread 在当前 workspace 下的 descendant threads

#### Scenario: unrelated threads in same workspace are excluded

- **GIVEN** 同一 workspace 内存在多个互不相关的任务线程
- **WHEN** 用户查看 activity panel
- **THEN** 面板 MUST NOT 混入与当前 active thread 无亲缘关系的其他线程活动

#### Scenario: missing direct parent may use fallback linking with explicit marker

- **GIVEN** 某个相关 thread 缺失 `threadParentById`
- **AND** 系统存在可用的 thread linking 元数据
- **WHEN** activity panel 构建相关 session 集
- **THEN** 系统 MAY 使用该 linking 元数据将 thread 纳入聚合范围
- **AND** 该 thread 或其事件 MUST 带有显式 fallback provenance 标记

### Requirement: Multi-Session Timeline Coverage

面板 MUST 以统一时间线作为默认主视图，并聚合至少三类核心活动：命令执行、任务推进、文件修改；`explore` 若展示，MUST 作为独立分类存在。

#### Scenario: panel shows command task and file-change events across sessions

- **WHEN** root session 或任一相关 child session 产生命令、任务、文件修改事件
- **THEN** activity panel MUST 将这些事件并入同一聚合视图
- **AND** 每条事件 MUST 标明 `kind`、`summary`、`status` 与来源 session

#### Scenario: explore events stay visible without polluting executable categories

- **WHEN** 系统收到 `explore` 事件，例如 `run`、`search`、`read`、`list`
- **THEN** activity panel MAY 将其展示为独立 timeline event
- **AND** 该事件 MUST 使用独立 `explore` 分类，而不是伪装成 `command` 或 `task`
- **AND** `command / task / fileChange` 的统计与筛选 MUST 不受 `explore` 污染

#### Scenario: timeline is the default scanning mode

- **WHEN** 用户首次打开 activity panel
- **THEN** 面板 MUST 默认展示按时间组织的聚合时间线
- **AND** session 分组视图如存在，MAY 作为辅助筛选或切换视图，而不是默认主视图

#### Scenario: child session activity is visible in merged timeline

- **WHEN** AI 为当前任务拉起子 session 或子 agent session
- **THEN** 子 session 的关键活动 MUST 出现在 activity panel 中
- **AND** 用户 MUST 能区分该活动来自 root session 还是 child session

#### Scenario: reasoning events remain excluded from phase one timeline

- **WHEN** 系统收到 `reasoning` 或其他纯思考型事件
- **THEN** activity panel Phase One MUST NOT 将其作为独立 timeline event 展示
- **AND** 面板 MUST 保持 `command / task / fileChange` 三类操作事实为主

### Requirement: Realtime Incremental Refresh

activity panel MUST 随相关 session 的实时状态增量刷新，而不是仅在回合结束后一次性汇总。

#### Scenario: running command appears before turn completion

- **WHEN** 相关 session 正在执行命令且回合尚未结束
- **THEN** activity panel MUST 显示该命令的运行中状态
- **AND** 回合结束后 MUST 更新为完成态或失败态，而不是重新插入重复事件

#### Scenario: workspace switch isolates realtime updates

- **WHEN** 用户切换到其他 workspace 或切换到其他任务上下文
- **THEN** activity panel MUST 立即切换到新的聚合上下文
- **AND** 后续实时更新 MUST 仅作用于当前上下文

### Requirement: Session Provenance and Jump Actions

每条活动 MUST 暴露 session 来源，并 SHOULD 提供跳转到现有详情视图的入口。

#### Scenario: file-change event links to existing diff or file view

- **WHEN** activity panel 渲染文件修改事件
- **THEN** 事件 MUST 至少展示文件路径与增删摘要
- **AND** SHOULD 提供跳转到现有 diff 或 file view 的入口

#### Scenario: command event links to existing command detail surface

- **WHEN** activity panel 渲染命令事件
- **THEN** 事件 MUST 展示命令摘要与当前状态
- **AND** SHOULD 提供跳转到已有 tool card 或 runtime console 的入口

#### Scenario: command event supports lightweight output peek

- **WHEN** 命令事件处于运行中或刚完成
- **THEN** activity panel MAY 轻量展开最近少量输出或错误片段
- **AND** 该轻展开 MUST NOT 取代已有完整 command detail surface

### Requirement: Stable Empty Running and Completed States

activity panel MUST 为无数据、执行中、执行完成三种状态提供稳定反馈。

#### Scenario: empty state explains no activity yet

- **WHEN** 当前任务上下文尚未产生任何可展示活动
- **THEN** activity panel MUST 显示清晰空态提示
- **AND** 该空态 MUST 明确说明“当前尚无 session activity”

#### Scenario: completed state remains inspectable after execution finishes

- **WHEN** 当前任务的相关 session 已完成执行
- **THEN** activity panel MUST 保留最近活动的可查看时间线
- **AND** 面板 MUST 提供完成态语义，而不是回退为空态

### Requirement: SOLO View Exit Does Not Interrupt Execution

如果系统使用 `SOLO` 视图模式承载 activity 监控，则退出该视图 MUST NOT 中断底层 session 执行。

#### Scenario: user can leave solo while task is still running

- **WHEN** 用户处于 `SOLO` 视图
- **AND** 当前相关 session 仍在运行中
- **THEN** 系统 MUST 允许用户切回普通视图
- **AND** 切回操作 MUST NOT 中断命令、任务或文件修改流程

#### Scenario: re-entering solo restores current activity context

- **WHEN** 用户在运行中或运行后重新进入 `SOLO` 视图
- **THEN** 系统 SHOULD 恢复当前任务的 activity 上下文
- **AND** MUST NOT 将视图错误重置为初始空态

### Requirement: Adapter Boundary and Legacy Isolation

新 capability MUST 通过独立 adapter / selector / panel 模块实现，不得把 workspace 聚合逻辑侵入旧 UI 链路。

#### Scenario: activity panel consumes adapter view model instead of legacy ui output

- **WHEN** 实现 workspace session activity panel
- **THEN** 新面板 MUST 消费独立 adapter 输出的纯数据 view model
- **AND** MUST NOT 直接依赖旧 `StatusPanel` 或 `toolBlocks` 的 JSX 结构

#### Scenario: legacy single-thread surfaces remain scoped to their original responsibilities

- **WHEN** 新 capability 接入后
- **THEN** 旧的 `StatusPanel`、消息区 `tool cards`、`thread reducer` MUST 保持原有职责边界
- **AND** 仅允许发生只读 selector 暴露或纯函数抽取这类向后兼容的最小适配

### Requirement: Live Edit Preview Is Out Of Scope For Phase One

由 file-change event 反向驱动 editor/file view 自动打开文件的能力 MUST NOT 作为本提案第一阶段的默认行为。

#### Scenario: activity panel does not auto-steal editor focus by default

- **WHEN** 相关 session 产生新的 file-change event
- **THEN** activity panel MUST 默认仅展示事件与跳转入口
- **AND** 系统 MUST NOT 未经用户明确启用就自动抢占当前 editor 或 file view 焦点

#### Scenario: future live preview requires separate opt-in contract

- **WHEN** 后续产品决定支持“实时编辑预览”
- **THEN** 该能力 SHOULD 通过独立 capability 或显式 opt-in 契约定义
- **AND** 必须约束关闭开关、焦点抢占策略与界面抖动控制
