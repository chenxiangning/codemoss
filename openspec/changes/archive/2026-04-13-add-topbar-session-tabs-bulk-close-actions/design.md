## Context

当前 topbar session tabs 已有三块稳定能力：

- active-thread 事件驱动入窗；
- 全局 rotation window；
- 单个 `X` 关闭且不影响会话生命周期。

缺口在于：窗口里 tab 多起来后，用户没有批量整理手段。issue 292 明确要求的并不是“删除会话”，而是“像 IDE 一样管理打开窗口”。

这意味着本次设计必须守住一个边界：

`tab visibility != session lifecycle`

也就是说，任何批量关闭都只能改 `TopbarSessionWindows` 这个运行时窗口模型，不能调用 `removeThread`、不能复用 sidebar 的删除提示、不能触达后端 session 删除接口。

另一个现实问题是 tab 上限口径必须统一：这次要把实现、当前 change 文档和主规范全部收口为 `max=5`，否则后续任何 verify 都会持续出现“行为和规范不一致”。

## Goals / Non-Goals

**Goals**

- 为 topbar tabs 增加右键批量关闭能力。
- 保证所有批量关闭都只影响 topbar 可见窗口。
- 为 active tab 被关闭后的选择提供确定性 fallback。
- 让实现、变更文档和主规范重新对齐到 `max=5`。

**Non-Goals**

- 不删除 thread。
- 不终止 session。
- 不改 sidebar、activity、radar 的管理语义。
- 不新增持久化 topbar window 状态。

## Decisions

### Decision 1: 批量关闭逻辑全部下沉到 `topbarSessionTabs.ts` 纯函数层

新增以下 helper：

- `dismissAllTopbarSessionTabs`
- `dismissTopbarSessionTabsToLeft`
- `dismissTopbarSessionTabsToRight`
- `dismissCompletedTopbarSessionTabs`

原因：

- 可以把“按当前位置裁剪窗口”与“按完成状态过滤窗口”做成稳定纯函数。
- 组件层只负责菜单事件，不承载窗口状态算法。
- 测试可以直接对 `TopbarSessionWindows` 做断言，不需要走整套 UI。

### Decision 2: 右键菜单只挂在 `TopbarSessionTabs`，不复用 sidebar thread menu

`TopbarSessionTabs` 代表的是“顶部已打开会话窗口”，而 sidebar thread menu 代表的是“线程实体操作”。

两者语义不同：

- topbar menu：关窗口
- sidebar menu：线程级操作（重命名、同步、删除等）

如果直接复用 sidebar menu，后面极容易把“关闭 tab”做成“删除会话”。

### Decision 3: “关闭全部已完成” 首期以 `isProcessing === false` 判定

已完成状态来自现有 `threadStatusById`：

- `isProcessing = true` 视为仍在运行
- `isProcessing = false` 视为可关闭的已完成 tab

不额外引入“历史完成态 / recent completed / review state”的复合语义，避免第一版过度设计。

`isReviewing` 与 `hasUnread` 不参与“已完成”判定。

### Decision 4: active tab 被批量关闭时采用“邻近优先” fallback

规则如下：

1. 若关闭后 active tab 仍存在：不切换。
2. 若 active tab 被关闭：
   - 优先选关闭前位置右侧最近的剩余 tab；
   - 若右侧没有，则选左侧最近的剩余 tab；
   - 若窗口已空，则不再选 thread，只保留当前 workspace 上下文。

不采用“总是最后一个 tab”：

- 它不符合 IDE 常见心智模型；
- 对 `关闭右侧` / `关闭左侧` 的用户预期不自然；
- 会让关闭动作和空间位置脱钩。

### Decision 5: 菜单禁用态必须显式，不做 silent no-op

菜单禁用规则：

- 无左侧 tab：禁用 `关闭左侧标签`
- 无右侧 tab：禁用 `关闭右侧标签`
- 无已完成 tab：禁用 `关闭全部已完成标签`
- 仅一个 tab 时：`关闭全部标签` 仍可用

原因：批量关闭是强语义操作，用户需要知道“为什么当前动作不可执行”，而不是点了没反应。

### Decision 6: 对齐 `TOPBAR_SESSION_TAB_MAX = 5`

这是口径统一，不是新产品能力。

本次直接在代码、测试和规范里统一为 `5`，并把该对齐写入 tasks，避免后续 verify 时继续出现 capability drift。

## Risks / Trade-offs

- [Risk] “已完成”语义过于宽松，把纯历史 tab 也一起关掉
  - Mitigation: 首期明确只按 `isProcessing`，并在 spec 中写死；如果后面要扩展“recent completed”语义，再另开 change。

- [Risk] active fallback 和用户直觉不一致
  - Mitigation: 采用邻近优先，并补纯函数测试覆盖左/右/全部关闭三类场景。

- [Risk] 右键菜单逻辑让 `TopbarSessionTabs.tsx` 再次膨胀
  - Mitigation: 组件只抛 `onContextMenu`，菜单构建和状态提交放到 `useLayoutNodes.tsx`。

- [Risk] 批量关闭误触发 thread 删除
  - Mitigation: 设计上不允许触达 `removeThread`，测试上显式断言窗口管理 helper 只返回新 `TopbarSessionWindows`。

## Migration Plan

1. 在纯函数层实现四类批量关闭 helper，并把常量上限改为 `4`。
2. 在 `TopbarSessionTabs` 增加右键入口与上下文定位。
3. 在 `useLayoutNodes` 构建 Tauri context menu，并将动作映射到窗口 helper。
4. 补 active fallback 逻辑，保证关闭当前 tab 后仍有稳定选中行为。
5. 补 i18n 与定向测试。
6. 执行定向 vitest 与 `openspec validate --strict`。
