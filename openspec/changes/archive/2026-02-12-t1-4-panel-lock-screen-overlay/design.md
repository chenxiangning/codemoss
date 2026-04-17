# Design: T1-4 Panel Lock Screen Overlay

## Context

当前主界面标题栏已有 Open in、复制会话等操作，但没有“临时离席保护”入口。用户目标不是终止会话，而是在会话继续跑的情况下，防止他人查看和误操作。项目已有
`clientStorage` 机制可做轻量本地持久化，适合本次“默认密码 + 可修改 + 明文存储”的约束。

## Goals / Non-Goals

**Goals:**

- 在标题栏新增锁屏按钮，交互位置靠近现有快捷操作。
- 锁屏后覆盖主界面，提供解锁输入与密码修改。
- 保障锁屏期间后台任务不受影响。
- 锁屏页展示 CodeMoss 核心功能介绍，避免空白页面。

**Non-Goals:**

- 不做系统级安全能力。
- 不增加服务端存储或账号体系。
- 不改动会话调度、消息流与执行队列。

## Decisions

### Decision 1: 密码存储位置采用 `clientStorage(app)`

- 选择：`writeClientStoreValue("app", "panelLockPassword", value)`。
- 原因：无需扩展 Rust `AppSettings`，落地快、风险小，满足明文可恢复诉求。
- 备选：写入 `AppSettings`（后端改动大，收益低）。

### Decision 2: 锁屏状态仅保存在内存态

- 选择：`App.tsx` 中维护 `isPanelLocked` 与输入状态。
- 原因：锁屏是临时态，重启后不强制保持锁定更符合桌面体验。
- 备选：持久化锁定态（易引发启动即锁死、恢复复杂）。

### Decision 3: 挂载点放在 `App` 根层

- 选择：在 `AppLayout` 同层渲染 `LockScreenOverlay`，使用高 `z-index` 全屏覆盖。
- 原因：覆盖范围完整，避免各布局分支（Desktop/Tablet/Phone）重复接入。
- 备选：在各 Layout 内分别加遮罩（重复代码，维护成本高）。

### Decision 4: 锁屏页采用“介绍卡片 + 解锁面板”双区布局

- 选择：左侧功能介绍，右侧解锁与改密表单；移动端降级为纵向。
- 原因：满足“不是空白页”的展示诉求，并保持解锁操作聚焦。
- 备选：仅密码框（信息价值低）。

## Risks / Trade-offs

- [明文密码可被本地读取] → 明确定位为隐私遮罩而非安全防护，并在文案说明。
- [遮罩可能阻断误触外的快捷键] → 限制仅拦截界面点击，不改动后台任务与 IPC。
- [功能介绍过长导致视觉拥挤] → 采用分类卡片与响应式两列网格。

## Migration Plan

1. 新增 `LockScreenOverlay` 组件与样式文件。
2. 在 `MainHeader` 增加锁头按钮回调。
3. 在 `useLayoutNodes`/`App.tsx` 传递回调并挂载遮罩。
4. 接入 `clientStorage(app)` 密码读取/写入逻辑。
5. 补充 i18n 文案与最小验证。

回滚方案：

- 删除锁屏按钮入口与遮罩挂载点，移除新增样式和文案键即可；不影响现有会话数据结构。

## Open Questions

- 是否需要后续追加“自动锁屏（闲置 N 分钟）”开关。
- 是否在设置页显式暴露“重置锁屏密码”入口（本次暂不做）。
