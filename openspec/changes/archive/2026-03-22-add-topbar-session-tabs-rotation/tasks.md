## 1. Topbar 会话窗口模型（P0，前置）

- [x] 1.1 [P0][depends: none] 在 `useLayoutNodes` 建立 topbar 会话窗口 selector（输入：`activeWorkspaceId/activeThreadId/threadsByWorkspace`；输出：全局 `recentSessionTabs(max=4)`）。
- [x] 1.2 [P0][depends: 1.1] 将轮转上限从 `max=5` 调整为 `max=4`，并保持 active 永不淘汰。
- [x] 1.3 [P0][depends: 1.1] 打破 workspace 隔离，改为跨 workspace 全局轮转窗口。
- [x] 1.4 [P0][depends: 1.1] 固化高亮判定键为 `workspaceId + threadId`，修复切换错高亮问题。
- [x] 1.5 [P0][depends: 1.1] 实现“active-thread 事件”准入守卫（未激活 thread 不入窗）。
- [x] 1.6 [P0][depends: 1.1] 实现失效引用清理（删除/归档/不可解析 thread 自动移除 tab）。
- [x] 1.7 [P0][depends: 1.2] 固化并列淘汰 tie-break（`activationOrdinal` + `workspaceId::threadId`）。
- [x] 1.8 [P0][depends: 1.1] 保持 Phase-1 运行时本地状态（重启后空窗口并按激活事件重建）。

## 2. Topbar 组件接入（P0，依赖 1.x）

- [x] 2.1 [P0][depends: 1.2] 新增/更新 `TopbarSessionTabs` 组件契约（输入：跨 workspace tab 列表 + active + callbacks）。
- [x] 2.2 [P0][depends: 2.1] 将 tabs 区域接入 `MainHeader/MainTopbar` 中段，保持标题/会话/操作三段布局。
- [x] 2.3 [P0][depends: 2.2] 点击 tab 复用 `onSelectThread(workspaceId, threadId)`，不创建新会话。
- [x] 2.4 [P0][depends: 2.2] 显式处理 no-drag 命中区，确保 titlebar 点击不被吞掉。
- [x] 2.5 [P0][depends: 2.2] 保持 desktop-only 渲染守卫（phone/tablet 不渲染）。
- [x] 2.6 [P1][depends: 2.1] tab 文案回退链：`thread.title` -> `Untitled Session + shortThreadId`。
- [x] 2.7 [P1][depends: 2.1] 增加 tab `X` 关闭动作：关闭仅移出 topbar 窗口，不删除 thread、不终止会话。

## 3. 布局与可访问性收敛（P1，依赖 2.x）

- [x] 3.1 [P1][depends: 2.2] 更新 `main.css/sidebar.css` 收缩策略（`1280/1024/800` 下 active 可见、actions 可点）。
- [x] 3.2 [P1][depends: 2.1] 增强 aria/tooltip/active 语义，暴露完整标题与状态。
- [x] 3.3 [P1][depends: 2.1] tab 文本展示长度调整为超过 7 个字后 `...`。
- [x] 3.4 [P1][depends: 2.2] tab 视觉改为紧密连接按钮组（直角）。
- [x] 3.5 [P1][depends: 3.4] 移除 tab 组外边框，保留连接分隔语义。

## 4. 回归测试与质量门禁（P0，收尾）

- [x] 4.1 [P0][depends: 1.x,2.x,3.x] 补齐单测（全局轮转、max=4、active 保留、切换语义、失效清理、重启重建）。
- [x] 4.2 [P0][depends: 4.1] 补齐高亮回归（`workspaceId + threadId` 双键匹配）。
- [x] 4.3 [P0][depends: 4.1] 补齐 7 字截断 + 完整 tooltip/aria 断言。
- [x] 4.4 [P0][depends: 4.1] 补齐 `X` 关闭行为断言（仅移除 tab，不影响生命周期）。
- [x] 4.5 [P0][depends: 4.1] 运行类型检查（`pnpm tsc --noEmit`）。
- [x] 4.6 [P0][depends: 4.1] 零回归验证（发送链路、sidebar/radar/activity、MainHeader actions 行为不变）。
- [x] 4.7 [P0][depends: 4.1] 三档宽度回归（`1280/1024/800`：active 可见、actions 可点、命中区达标）。
- [x] 4.8 [P0][depends: 4.1] Win/mac 兼容验证（窗口控制区不遮挡、tabs/close 可点、拖拽可用）。
- [x] 4.9 [P0][depends: 4.5,4.6,4.7,4.8] OpenSpec 严格校验（`openspec validate add-topbar-session-tabs-rotation --strict`）。

## 5. Artifact 同步（P0，文档收口）

- [x] 5.1 [P0][depends: 4.9] 同步 `proposal.md` 到验收版口径（全局轮转/max=4/7字截断/X关闭/无外边框）。
- [x] 5.2 [P0][depends: 4.9] 同步 `design.md` 决策与风险，移除旧 `max=5` 与 workspace 隔离描述。
- [x] 5.3 [P0][depends: 4.9] 同步 `specs/**/*.md` 要求与场景，确保与最终实现一致。

