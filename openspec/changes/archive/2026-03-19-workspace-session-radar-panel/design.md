## Context

当前产品已经具备两块相关能力：

- 左侧项目树：`WorkspaceCard` / `WorktreeSection` 已有 `is-session-running` 信号，但仅覆盖“是否进行中”，缺少“最近完成”与数量级信息。
- 右侧面板：`WorkspaceSessionActivityPanel` 以当前任务 root-subtree 为聚合范围，适合深度排查，不适合多项目全局巡检。

在多项目并行场景下，用户会频繁折叠项目树与 worktree，导致会话状态可见性下降。  
并且当前 `lockLiveSessions` 与完成态追踪逻辑已存在于 `app-shell.tsx`，具备复用基础，不需要新增后端协议。

## Goals / Non-Goals

**Goals:**

- 形成“左信号、右详情”的双层信息架构：
- 左侧：项目级 running/recent 轻量标识，折叠后仍可扫描。
- 右侧：顶部独立 `Radar` Tab，聚合进行中与最近完成并支持跳转。
- 复用既有会话状态来源，避免重复状态机与并行判定逻辑。
- 保证现有 `Current Task Activity` 行为不回退。

**Non-Goals:**

- 不改 Rust 会话命令协议。
- 不改 thread 存储结构与历史载荷格式。
- 不引入自动切线程、自动弹窗或强制抢焦点行为。

## Decisions

### Decision 1: 主面板落右侧独立 Radar Tab，左侧只做信号层

- 选择：右侧在 `PanelTabs` 新增独立 `Radar` Tab 承载“进行中 + 最近完成”详情；左侧仅保留项目级信号。
- 原因：
- 左侧本职是导航（项目、worktree、thread），加入详情会挤压层级可读性。
- 右侧已有 `PanelTabs + right-panel-top` 结构，天然适配信息密集列表与跳转行为。
- 备选方案：
- 左侧新增完整列表：空间竞争严重，折叠策略复杂。
- 底部 Dock：侵占聊天主视区高度，与 terminal/debug/plan 竞争。

### Decision 2: 复用现有聚合信号，抽取统一 selector

- 选择：以 `app-shell.tsx` 中现有 `lockLiveSessions` 与完成态追踪为基础，下沉到可复用 selector/hook（如 `useSessionRadarFeed`）。
- 原因：
- 避免“运行态判定”在 Sidebar、LockOverlay、RadarPanel 三处重复实现。
- 能复用当前“进行中 -> 完成”多信号判定，降低行为回归。
- 备选方案：
- 新写一套独立聚合逻辑：短期快，但后续一致性风险高。

### Decision 3: 最近完成采用时间窗 + 数量上限

- 选择：最近完成列表使用“时间窗过滤（例如 30 分钟）+ 条数上限（例如 20）”。
- 原因：
- 防止列表无限增长影响渲染和扫描效率。
- 保证“刚完成任务”可见而不变成历史归档页。
- 备选方案：
- 永久累计：信息噪声过高。
- 仅显示最后 1 条：丢失并发场景价值。

### Decision 3.1: 最近完成按日期分组，默认收起

- 选择：最近完成列表按 `YYYY-MM-DD` 分组，日期卡片默认收起，点击展开查看会话条目。
- 原因：
- 在最近完成条目较多时，分组能显著降低视觉噪声，提高“按天回看”效率。
- 默认收起可以保证 Radar 打开时优先暴露“进行中”信息，符合即时任务优先原则。
- 备选方案：
- 平铺全部最近完成：信息密度过高，滚动成本高。
- 仅按时间排序不分组：缺少按天定位能力。

### Decision 4: Sidebar 信号采用“数量徽标 + 短时完成标记”

- 选择：
- 进行中：显示计数徽标（含 worktree 汇总）。
- 最近完成：显示短时完成标记（TTL 自动衰减）。
- 原因：
- 用户在折叠态下需要“一眼判断是否值得展开”。
- 单一颜色呼吸动画不足以表达“刚完成”语义。
- 备选方案：
- 只保留当前绿点动画：表达维度不足。

### Decision 5: 交互最小侵入，跳转优先

- 选择：Radar 列表项只提供显式跳转（workspace + thread），不做自动展开/自动切 tab。
- 原因：
- 保持用户主工作流稳定，不抢焦点。
- 与现有通知点击跳转模式一致。
- 备选方案：
- hover 自动预览或自动切换：干扰性强，误触成本高。

### Decision 6: Radar 轻量状态独立落盘到 `leida` store

- 选择：将 Radar 的轻量状态（recent refs / read state / date group collapse state）独立存到 `leida.json`，并保留对历史 `app` store 的读取兼容。
- 原因：
- 避免 `app.json` 持续膨胀，降低无关模块耦合。
- Radar 仅保存索引态，不保存完整会话内容，保证长期可控。
- 备选方案：
- 继续写入 `app`：短期实现简单，但增长不可控、语义混杂。

## Risks / Trade-offs

- [信号过多导致 Sidebar 噪声上升] → 通过上限/聚合计数与低对比度样式控制视觉权重。
- [进行中与最近完成切换抖动] → 引入最短展示时长与完成态 TTL，避免瞬时闪烁。
- [多工作区聚合导致重复条目] → 使用 `workspaceId:threadId` 作为稳定主键去重。
- [右侧面板默认宽度不足影响可读性] → 复用现有右侧可拖拽宽度与截断策略，不新增固定宽度约束。
- [现有 activity 面板行为回归] → 通过“Activity/Radar 面板分离”与回归测试锁定既有行为。
- [轻量状态文件增长] → 仅保存 recent 引用与读状态，按时间窗裁剪并对 read state 做 activeIds prune。

## Migration Plan

1. 抽取会话聚合 selector，统一产出 running/recent feed。
2. 接入右侧独立 Radar Tab 与跳转交互（不替换现有 Current Task）。
3. 接入 Sidebar 项目级信号渲染（workspace/worktree 汇总）。
4. 增加 i18n 文案与可访问性标签。
5. 增加单测与集成回归（聚合、排序、TTL、跳转、折叠态可见性）。

回滚策略：

- 若出现可用性问题，优先通过 feature flag 关闭 Radar 视图；
- 保留现有 Activity 与 Sidebar 基础行为，不影响消息与线程主链路。

## Open Questions

- 最近完成时间窗默认值是否统一为 30 分钟，还是跟随用户偏好配置？
- Radar 视图按“全部工作区”还是“当前工作区优先 + 可切换”作为默认？
- Sidebar 最近完成标记是否需要区分成功完成与失败结束？
