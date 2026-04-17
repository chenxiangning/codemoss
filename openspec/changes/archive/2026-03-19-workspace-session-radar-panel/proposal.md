## Why

多项目并行时，用户经常会把项目树或 worktree 折叠，当前虽然已有项目级运行态高亮与右侧 activity 面板，但缺少“跨项目可扫描”的统一入口，导致进行中的会话和刚完成的会话不易被及时发现。现在需要把“信号可见性”与“详情查看”拆层设计，避免因为折叠结构而丢失关键状态。

## Update (2026-03-19)

- 当前变更 `workspace-session-radar-panel` 的实现任务已完成（见 `tasks.md` 全部勾选）。
- 提案目标保持不变：以“左侧信号 + 右侧 Radar 详情”的双层架构提升会话可发现性。
- 本次更新聚焦提案状态同步，作为后续 `verify/archive` 的基线文档。

## 目标与边界

### 目标

- 在不打断现有聊天流程的前提下，提供跨项目的会话状态可见性（进行中 + 最近完成）。
- 明确“左侧用于信号、右侧顶部 Tab 提供全局 Radar 详情”的职责分层，减少信息拥挤和交互冲突。
- 保持现有 `activity` 面板能力不回退，新增能力以增量模式接入。

### 边界

- 仅改前端信息架构、状态聚合与交互入口，不改后端会话协议与线程存储格式。
- 不新增自动打断、自动切换会话等高侵入行为，只提供可见性与跳转。
- 不改变现有线程执行语义（processing/completed 判定逻辑复用现有信号）。

## 非目标

- 不重构整个 Sidebar 组件树。
- 不新增跨设备同步、推送中心、消息订阅系统。
- 不在本提案中引入新的会话生命周期状态枚举。

## What Changes

- 已新增“Session Radar”聚合视图（右侧顶部独立 Tab）：
- 显示跨项目进行中会话列表。
- 显示最近完成会话列表（时间窗口可配置，默认近期），并按 `YYYY-MM-DD` 日期分组展示。
- 最近完成支持日期卡片折叠/展开，默认收起，状态可持久化。
- 支持点击跳转到目标 workspace/thread。
- 最近完成条目支持“未读/已读”角标（点击后标记为已读）。
- 已保留现有 `activity` 面板为 `Current Task` 单视图（现有 root-subtree 聚合，默认不变）。
- 已新增独立 `radar` 面板承载跨项目聚合视图。
- 已在左侧项目/工作树行增加轻量信号补强：
- 进行中数量徽标（或动态点）与最近完成短时标记。
- 当项目折叠时仍可见，不依赖展开线程列表。
- 顶栏/面板 Tab 增加全局信号（`radar` tab badge），用于右侧面板收起时的可发现性。

## 技术方案对比

### 方案 A：主面板放左侧（Sidebar 内新增会话区）

- 优点：与项目列表距离近，切换成本低。
- 缺点：左侧已经承担导航主职责；加入会话详情后容易压缩项目树空间，且在 sidebar 收起时整体不可见。

### 方案 B：主面板放右侧（新增独立 Radar Tab）+ 左侧仅做轻量信号（推荐）

- 优点：与现有 `PanelTabs`、`lockLiveSessions` 聚合信号天然对齐，入口更直接；左侧继续专注导航。
- 缺点：用户需要一次视线切换到右侧查看详情。

### 方案 C：新增底部 Dock（类似终端）

- 优点：不会挤压左右侧导航/文件树。
- 缺点：与现有 Plan/Terminal/Debug 竞争纵向空间，聊天主画布可视高度下降明显。

### 取舍结论

采用 **方案 B**：**右侧通过独立 `Radar` Tab 承载“详情面板”**，**左侧承载“状态信号”**。  
这与当前代码结构和主流 IDE 布局习惯更一致：导航在左、详情在右，状态通过徽标快速扫描。

## 验收标准

- 用户在多项目并行时，即使项目树折叠，仍能在左侧看到哪些项目存在进行中或刚完成会话。
- 用户打开右侧 `radar` 后，可看到跨项目进行中与最近完成会话，并可一键跳转。
- `Current Task` 现有行为保持不变：root-subtree 聚合、时间线展示与筛选能力不回退。
- 当右侧面板收起时，用户仍可通过 `radar` tab 级别信号感知存在运行中会话。
- 在 20+ 会话并发的场景下，列表滚动与跳转交互保持稳定，不出现明显卡顿或重复条目闪烁。

当前状态：以上验收条目已对应到已完成任务项（见 `tasks.md` 的 1.x ~ 5.x）。

## Capabilities

### New Capabilities

- `workspace-session-radar-overview`: 定义跨项目进行中/最近完成会话的聚合视图、排序规则、分组与跳转契约。

### Modified Capabilities

- `workspace-sidebar-visual-harmony`: 增加“项目折叠态仍可见的会话状态信号”要求（进行中/最近完成）。
- `codex-chat-canvas-workspace-session-activity-panel`: 保持 `Activity` 面板现有 `Current Task` 行为不回退，同时新增独立 `Radar` 面板入口。

## Impact

- 受影响前端模块（预期）：
- `src/features/app/components/Sidebar.tsx`
- `src/features/app/components/WorkspaceCard.tsx`
- `src/styles/sidebar.css`
- `src/features/layout/hooks/useLayoutNodes.tsx`
- `src/features/layout/components/PanelTabs.tsx`
- `src/features/session-activity/components/WorkspaceSessionRadarPanel.tsx`
- `src/features/session-activity/components/WorkspaceSessionActivityPanel.tsx`
- `src/features/session-activity/hooks/useWorkspaceSessionActivity.ts`
- `src/app-shell.tsx`（复用与下沉 `lockLiveSessions` / completed 聚合逻辑）
- `src/features/session-activity/hooks/useSessionRadarFeed.ts`（全局 running/recent 聚合与轻量落盘）
- `src/services/clientStorage.ts`（新增 `leida` store 类型）
- `src-tauri/src/client_storage.rs`（放开 `leida` store 白名单）
- 受影响测试（预期）：
- Sidebar 会话状态信号测试。
- Activity 与 Radar 分离后的回归测试。
- 跨项目跳转与排序去重测试。
