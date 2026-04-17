## Context

desktop workspace chat 的主 topbar 已承载项目标题、分支、运行类操作。  
本变更在该区域新增“会话 tab 组”并保持零回归，目标是把高频会话切换前置到 1 步动作。

最终验收口径（2026-03-22）：

- 会话窗口为跨 workspace 全局轮转，不再按 workspace 隔离。
- 轮转上限 `max=4`，active tab 永远保留。
- 高亮/切换上下文以 `workspaceId + threadId` 双键判定。
- tab 文本超过 7 个字后显示 `...`，完整文本保留到 tooltip/aria。
- 每个 tab 提供 `X` 关闭能力，关闭仅移出 topbar，不影响 thread 生命周期。
- tab 组外边框移除，外观为紧密直角按钮组。

## Goals / Non-Goals

**Goals:**

- 在 desktop workspace chat 中实现 topbar 1 步会话切换。
- 在不改后端协议与生命周期模型的前提下，提供稳定的 4 槽轮转窗口。
- 保持既有 MainHeader actions、sidebar、activity/radar 行为不回退。
- 保持 Win/mac titlebar 命中区兼容，不出现点击被 drag region 吞掉。

**Non-Goals:**

- 不引入新后端接口与持久化 schema 变更。
- 不做无限 tab 管理（拖拽重排、分组、批量管理）。
- 不改 phone/tablet 导航结构。
- Phase-1 不引入 `+N` overflow 菜单。

## Decisions

### Decision 1: 会话窗口改为跨 workspace 全局轮转

- 选择：维护单一窗口 `TopbarSessionWindows.tabs[]`，元素为 `{ workspaceId, threadId }`。
- 原因：符合用户“打破项目限制”的明确要求，支持跨项目并行切换。
- 约束：切换与高亮必须带上 workspace 上下文，避免同 threadId 误命中。

### Decision 2: 固定上限 `max=4`，并保留 active

- 选择：超过 4 个时淘汰最旧非 active 项。
- 原因：在顶部空间有限前提下，4 个可兼顾信息密度与操作区可达性。

### Decision 3: 淘汰策略保持确定性

- 选择：优先按 `activationOrdinal` 升序淘汰，异常并列时按 `workspaceId::threadId` 字典序兜底。
- 原因：避免边界条件随机行为，确保测试可重复。

### Decision 4: 高亮与切换统一用 `workspaceId + threadId`

- 选择：`isActive = (tab.workspaceId === activeWorkspaceId && tab.threadId === activeThreadId)`。
- 原因：修复“跨项目切换时 tab 高亮错位”问题。

### Decision 5: tab 文本展示策略固定为 7 字截断

- 选择：显示文本超过 7 个字后追加 `...`；完整标题放 `title/aria-label`。
- 原因：保证窄宽度下扫描效率与可读性平衡。

### Decision 6: tab 增加 `X` 关闭，仅影响 topbar 可见窗口

- 选择：关闭动作从窗口移除该 tab，不删除 thread，不停止运行。
- 原因：满足用户可控降噪诉求，同时保证生命周期语义稳定。

### Decision 7: 样式采用紧密直角按钮组，移除组外边框

- 选择：按钮之间使用分隔线语义，整体无圆角、无外包边框。
- 原因：符合目标视觉语言并减少视觉噪音。

### Decision 8: 继续复用现有 `onSelectThread` 链路

- 选择：tab 点击仍走现有 thread 选择入口，不创建新会话。
- 原因：最小行为变更，回归风险最低。

### Decision 9: 运行时本地状态，重启后不恢复

- 选择：窗口状态仅在前端运行时保留；重启后按新激活事件重建。
- 原因：保持 Phase-1 低侵入，不引入持久化迁移。

## Risks / Trade-offs

- [topbar 挤压]：通过 7 字截断、4 槽上限、按钮组压缩策略控制。
- [跨 workspace 错高亮]：通过双键判定与测试覆盖控制。
- [关闭语义误解]：明确 `X` 仅移除 topbar 可见项，不删会话。
- [titlebar 兼容风险]：继续强制 no-drag 命中区并保留 Win/mac inset 约束。

## Migration Plan

1. 更新窗口模型：workspace 维度 -> 全局窗口，`max=4`。
2. 更新 `TopbarSessionTabs` 契约：tab 携带 `workspaceId/engine/displayLabel`，支持关闭事件。
3. 更新渲染链路：点击与高亮统一走 `workspaceId + threadId`。
4. 更新样式：紧密直角按钮组、移除组外边框、保留内部连接语义。
5. 更新测试：轮转、跨 workspace、高亮、7 字截断、关闭行为、窄宽度可点。
6. 更新文档：proposal/specs/tasks 全量同步。

## Validation Snapshot

- 功能验收：通过（用户 2026-03-22 反馈“整体功能都测了，没问题”）。
- 工程校验：`openspec validate add-topbar-session-tabs-rotation --strict` 通过。

