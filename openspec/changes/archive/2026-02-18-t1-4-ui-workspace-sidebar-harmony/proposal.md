# Proposal: T1-4 UI Workspace Sidebar Harmony

## 实施状态（2026-02-18）

- 变更状态：`In Progress`（功能主干已完成，仍有少量像素级微调）
- 实施进度：`约 85%`
- 当前结论：已超出原始提案范围，需补充记录“侧栏结构升级与顶部联动”相关 UI-only 调整

## Why

当前左侧项目管理区存在明显的视觉失衡：

- 信息密度突变：市场入口区域稀疏，workspace/thread 区域过密。
- 层级不清：workspace 容器、worktree、thread 的视觉权重接近，扫描成本高。
- 选中态冲突：workspace 与 thread 同时高亮，焦点语义不唯一。
- 容器感过强：局部区域像“面板套面板”，与全局 sidebar 语言不一致。

这些问题不会直接导致功能失败，但会持续降低导航效率、增加认知负担。

## 目标与边界

### 目标

1. 统一左侧导航的信息节奏，让 workspace 区域与上方入口区视觉连贯。
2. 建立清晰层级：`section > workspace > worktree > thread`。
3. 将“焦点”收敛为单一主焦点（single primary focus），消除双焦点冲突。
4. 保持现有操作能力不变（新建、展开、切换、更多菜单都可用）。

### 边界

- 仅调整 UI 表现层（layout、spacing、typography、color token、hover/active state）。
- 不修改任何后端 command、数据结构、会话生命周期逻辑。
- 不新增业务功能（如排序策略、过滤逻辑、批量管理策略）。

## 非目标

- 不重构 sidebar 数据流和 hooks。
- 不改动 workspace/worktree/thread 的 CRUD 行为。
- 不引入新设计系统或第三方 UI 框架。

## 方案对比与取舍

### 方案 A：局部微调（仅 patch CSS）

- 做法：只改 `sidebar.css` 的间距、颜色、圆角。
- 优点：开发快，风险低。
- 缺点：结构层级仍模糊，无法根治“双焦点”与“容器割裂”问题。

### 方案 B：结构 + 样式联合重排（选中）

- 做法：小幅调整组件结构语义（section header / list grouping）+ token 化样式。
- 优点：可同时解决层级、焦点、密度三类问题；回归风险可控。
- 缺点：改动面比纯 CSS 略大，需要补充视觉回归检查。

### 方案 C：全量侧栏重构

- 做法：重写 sidebar 组件树和设计语言。
- 优点：理论上最彻底。
- 缺点：超出本次 UI-only 改造边界，影响面过大。

最终选择 **方案 B**，因为它在“改善幅度/实现成本/回归风险”三者间最平衡。

## 本轮补充范围（超出原提案）

以下内容属于本轮实际交付，但不在初始提案明确列出，现补充入案：

1. **独立左侧图标栏（Rail）**
    - 新增独立 rail，承载 `对话/面板/MCP/长期记忆/插件市场/设置/终端/折叠`。
    - 支持折叠态与展开态，且 rail 与 workspace 列表滚动解耦。
2. **Topbar 联动策略**
    - 在“显示对话侧边栏”场景下，将项目标题块迁移至侧栏头部。
    - 右上操作区（启动/打开/锁定/复制等）保持主 topbar 原位，不参与迁移。
    - 在“隐藏侧边栏”时，标题块回归主 topbar 原位置。
3. **对齐与裁剪修复**
    - 统一左右 topbar 高度基线。
    - 修复项目下拉在侧栏头部场景的裁剪/遮罩问题（右对齐展开）。
    - 修复 rail 内按钮居中与滚动行为异常（底部按钮定位、错误滚动条）。

## What Changes

- 重构左侧项目区视觉层级：弱化外层容器感，强化 section 标题与组内节奏。
- 统一状态体系：
    - 主选中：仅当前激活 thread 行呈现强高亮。
    - 次级选中：所属 workspace 仅显示轻量指示（左侧细条或弱底色）。
- 调整密度与排版：
    - workspace 行高、thread 行高、组间距统一为一套 4pt 体系。
    - 时间戳/辅助信息对比度下调，避免与标题争夺注意力。
- worktrees 区域改为“默认紧凑 + 渐进展开”，首屏噪音降低。

## Capabilities

### New Capabilities

- `workspace-sidebar-visual-harmony`: 统一 sidebar 项目管理区的视觉层级、状态语义和密度节奏。

### Modified Capabilities

- 无（不改变既有业务 capability 的行为语义）。

## Impact

### Frontend

- `src/features/app/components/Sidebar.tsx`
- `src/features/app/components/WorkspaceCard.tsx`
- `src/features/app/components/ThreadList.tsx`
- `src/features/app/components/WorktreeSection.tsx`
- `src/styles/sidebar.css`
- `src/features/app/components/SidebarMarketLinks.tsx`
- `src/features/app/components/MainHeader.tsx`
- `src/features/app/components/AppLayout.tsx`
- `src/App.tsx`
- `src/styles/main.css`
- `src/styles/base.css`

### Product UX

- 左侧导航扫描路径更短，状态判断更直接。
- 减少误判“当前到底选中 workspace 还是 session”的认知摩擦。

## 验收标准

1. 视觉焦点一致：同一时刻仅存在一个主高亮行（激活 thread）。
2. 层级可辨识：workspace、worktree、thread 在 3 秒内可被新用户正确区分。
3. 密度连续：上方 market links 与 workspace 区域过渡自然，无明显“割裂块”。
4. 功能无回归：新增会话、切换会话、展开折叠、右键菜单行为保持不变。
5. Topbar 一致性：侧栏与主区 topbar 高度一致，边线齐平。
6. 下拉可用性：项目下拉在侧栏头部场景可完整显示，不被裁剪。
