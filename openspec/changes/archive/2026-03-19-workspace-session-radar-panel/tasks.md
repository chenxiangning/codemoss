## 1. 会话聚合基线抽取（P0，前置）

- [x] 1.1 抽取 `useSessionRadarFeed`（输入：`threadsByWorkspace`、`threadStatusById`、`lastAgentMessageByThread`；输出：`runningSessions` + `recentCompletedSessions`；验证：hook 单测覆盖去重与排序）。
- [x] 1.2 将 `lockLiveSessions` 与完成态追踪逻辑迁移为共享 selector（依赖：1.1；输入：现有 app-shell 聚合逻辑；输出：LockOverlay 与 Radar 共用同源数据；验证：锁屏 live 列表行为无回归）。
- [x] 1.3 实现最近完成时间窗与数量上限控制（依赖：1.1；输入：完成态事件流；输出：可配置窗口内的 recent 列表；验证：超窗自动衰减测试通过）。

## 2. 全局 Session Radar 视图（P0，依赖 1.x）

- [x] 2.1 在右侧顶部 Tab 增加独立 `Radar` 入口（输入：现有 `PanelTabs`；输出：`Activity(当前任务)` 与 `Radar(全局)` 分离；验证：无需进入 activity 即可打开 Radar）。
- [x] 2.2 实现 Radar 分组渲染与条目跳转（依赖：2.1；输入：`runningSessions/recentCompletedSessions`；输出：进行中与最近完成分组 + 点击跳转；验证：跳转到正确 `workspaceId/threadId`）。
- [x] 2.3 保留右侧收起态 live 提示（依赖：2.1；输入：running 数量；输出：radar 入口可见状态信号；验证：右侧收起时仍可观察到提示）。
- [x] 2.4 最近完成按日期分组与折叠（依赖：2.2；输入：recent feed；输出：`YYYY-MM-DD` 日期卡片分组、默认收起与展开交互；验证：分组计数与展开收起测试通过）。
- [x] 2.5 最近完成未读/已读角标（依赖：2.2；输入：recent feed + read state；输出：未读显示“未读”角标、点击后已读勾选；验证：标记状态持久化与回显正常）。

## 3. 左侧 Sidebar 信号增强（P0，依赖 1.x）

- [x] 3.1 为 WorkspaceCard 增加进行中数量信号（输入：workspace + worktree 汇总态；输出：折叠态仍可见计数/状态；验证：项目折叠时信号存在）。
- [x] 3.2 增加“最近完成”短时标记（依赖：1.3；输入：recent feed；输出：TTL 内可见完成提示；验证：过窗自动消失，不残留样式）。
- [x] 3.3 对 worktree 汇总规则加回归保护（依赖：3.1；输入：父子工作区会话状态；输出：父 workspace 正确反映子 worktree 活跃态；验证：Sidebar 相关测试通过）。

## 4. 文案与可访问性（P1，依赖 2.x/3.x）

- [x] 4.1 补充 Radar 模式与状态信号 i18n 文案（输入：中英文 locale 资源；输出：新增 key 完整可翻译；验证：无缺失 key 警告）。
- [x] 4.2 增加 aria-label 与 tooltip（输入：新入口与信号节点；输出：可读可访问标签；验证：组件测试断言 aria/title）。

## 5. 回归验证与发布准备（P0，收尾）

- [x] 5.1 补齐测试：聚合逻辑、模式切换、跳转、Sidebar 折叠态信号（依赖：1.x-4.x；输入：新增/改动模块；输出：单测覆盖核心路径；验证：`pnpm vitest` 目标套件全绿）。
- [x] 5.2 运行类型检查与构建自检（依赖：5.1；输入：前端工程；输出：无新增类型错误；验证：`pnpm tsc --noEmit`、`pnpm run build` 通过）。
- [x] 5.3 手工验收多项目并行场景（依赖：5.2；输入：至少 3 个 workspace + 折叠态；输出：可见性与跳转符合提案；验证：验收截图与交互回放通过）。
- [x] 5.4 跨平台兼容性自检（依赖：5.2；输入：暂存区改动；输出：Win/Mac 路径与存储兼容结论；验证：`pnpm run doctor:strict`、`pnpm run doctor:win` 通过）。
