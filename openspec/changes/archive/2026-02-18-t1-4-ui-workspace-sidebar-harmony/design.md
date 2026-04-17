# Design: T1-4 UI Workspace Sidebar Harmony

## Sync Note（2026-02-18）

本设计文档已与最新 proposal/tasks 同步，补充了以下超出初始范围的 UI-only 变更：

- 独立左侧图标栏（Rail）与 workspace 列表分离；
- topbar 标题块在侧栏展开/收起间的条件迁移；
- 左右 topbar 高度基线统一；
- 侧栏头部项目下拉裁剪/遮罩修复。

## Context

当前实现在 `Sidebar/WorkspaceCard/ThreadList/WorktreeSection` 中将结构语义与视觉语义耦合较紧，导致：

- 视觉分组依赖大量局部 margin/padding 微调，缺乏统一 token。
- workspace 与 thread 的 active 样式强度接近，造成“双主角”。
- worktree 区域以边框+背景组织，容器感偏重。
- topbar 信息块在侧栏与主区之间缺乏明确策略，导致错位与视觉冲突。

## Goals / Non-Goals

### Goals

- 统一 spacing、radius、text emphasis token。
- 建立明确状态优先级：`active thread > active workspace context > hover`。
- 在不改业务逻辑前提下，提升项目区“可扫描性”。
- 建立稳定的 rail + projects 双列信息架构。
- 保证侧栏头部与主 topbar 的职责边界清晰（标题迁移，操作区稳定）。

### Non-Goals

- 不调整 hooks 与数据模型。
- 不改 IPC、Tauri commands。

## Information Architecture

### Visual Hierarchy

1. `Sidebar Section Title`（Projects）
2. `Workspace Row`（容器入口）
3. `Worktree Header`（次级分组）
4. `Thread Row`（最终操作目标）

### Rail + List Layout

- 左侧 rail：固定宽度，承载全局入口与底部动作。
- 右侧 list：唯一滚动容器，承载 projects/workspaces/worktrees/threads。
- 目标：rail 不随内容滚动，list 独立滚动。

### State Model

- `primary-active`: 仅 thread 行使用高对比底色 + 文字加强。
- `secondary-context`: workspace 行使用弱指示（边线/淡背景）。
- `hover`: 所有行统一低强度反馈。

## Style Tokens (UI-only)

- `--sidebar-space-1: 4px`
- `--sidebar-space-2: 8px`
- `--sidebar-space-3: 12px`
- `--sidebar-row-radius: 6px`
- `--sidebar-row-height-workspace: 30px`
- `--sidebar-row-height-thread: 26px`
- `--sidebar-color-active-primary: var(--surface-active)`
- `--sidebar-color-active-secondary: color-mix(in srgb, var(--surface-active) 35%, transparent)`
- `--main-topbar-height`（左右 topbar 高度统一基线）

## Interaction Spec

### Workspace Row

- 取消厚重底块；改为轻量背景 + 左侧细强调线（仅 active workspace 且 thread 不可见时可保留）。
- `...` 与 `+` 操作按钮仅 hover/focus 显示，保持噪音可控。

### Thread Row

- 主选中统一到 thread 行。
- 时间戳透明度降低，默认不与标题抢权重。

### Worktree Section

- header 维持低对比，展开符号有明确旋转反馈。
- 默认显示紧凑条目；超过阈值采用“更多”策略，减少首屏挤压。

### Topbar Relocation

- 当侧栏展开且处于对话工作区场景：项目标题入口迁移到侧栏头部。
- 主 topbar 保持右侧操作区原位，不随标题迁移。
- 当侧栏收起：项目标题入口回归主 topbar 原位置。

### Dropdown Visibility

- 侧栏头部项目下拉必须以右对齐展开（`right: 0`），避免超出容器后裁剪。
- 通过明确层级（z-index）确保下拉覆盖在内容层之上。

## Pseudocode (结构草图)

```text
render Sidebar
  render SidebarTopbarPlaceholder
    if sidebarExpanded && workspaceView
      render RelocatedProjectTitle
  render SidebarBodyLayout (rail + list)
    render Rail (fixed, non-scroll)
    render ProjectsList (single scroll container)
      render SectionHeader("Projects")
      for each WorkspaceGroup
        render GroupHeader
        for each Workspace
          render WorkspaceRow(state=secondary-context if active workspace)
          if expanded
            render WorktreeSection
            render ThreadList
              mark only active thread as primary-active
```

## Risks / Trade-offs

1. 风险：状态规则调整后，老用户需要短暂适应。
    - 缓解：保持操作位置稳定，不改按钮语义。
2. 风险：不同主题下 secondary-color 对比度不足。
    - 缓解：通过 CSS variables 覆盖深浅主题，并做对比度检查。
3. 风险：标题迁移后，主 topbar 与侧栏头部出现重复元素。
    - 缓解：使用条件渲染/样式隔离，仅迁移项目入口，保留主区操作区。
4. 取舍：选择“轻结构调整 + 样式重排”，而非全量重写，保证回归风险可控。

## Verification Plan

- 手动视觉检查：亮/暗主题下，三层层级辨识是否清晰。
- 行为回归：workspace 切换、thread 切换、more 菜单、新建会话。
- 交互回归：hover/focus/active 状态互斥与优先级正确。
- topbar 对齐验证：左右高度一致、分割线齐平。
- 下拉可用性验证：侧栏头部场景项目下拉完整可见且可点击。
