## Context

当前产品里已经存在三类与“session activity”强相关的老能力：

- 线程事实源：`ConversationItem[]`、`threadStatusById`、`threadParentById`
- 紧凑摘要视图：底部 `StatusPanel`
- 局部详情视图：消息区 `tool blocks`、runtime console、git panel

这些能力本身并不缺，只是它们的职责都是局部的。现在要新增的是一个**workspace 级多 session 聚合监控面板**，让用户在右侧看到主 session 与 AI 派生子 session 的实时活动汇流。

你已经明确要求：这是**新功能新代码**，不能为追求接入速度去“顺手重构老逻辑”。因此本设计的核心不是重新发明事件模型，而是建立一层**adapter / selector 边界**，把老事实源转换成新面板可消费的 view model。

## Goals / Non-Goals

**Goals**

- 为右侧新增一个独立的 `workspace session activity panel`
- 聚合当前 workspace 下主 session 与派生子 session 的命令、任务、文件修改
- 用新增 adapter 层复用现有线程状态与消息事实源
- 让新面板与旧的 status panel / tool cards 保持摘要一致，但实现边界独立

**Non-Goals**

- 不重写 `useStatusPanelData`
- 不把旧的 `StatusPanel` 直接改造成右侧大面板
- 不改写 `useThreadsReducer` 的主职责
- 不让 `Messages`、`toolBlocks` 为新面板承担聚合逻辑

## Decisions

### Decision 1: 新增 `workspace session activity adapter`，不直接扩写旧 UI 组件

- 选择：新增一层聚合 selector，例如 `useWorkspaceSessionActivity` 或同等模块，输入为：
  - `workspaceId`
  - `threadsByWorkspace`
  - `activeThreadIdByWorkspace`
  - `itemsByThread`
  - `threadStatusById`
  - `threadParentById`
- 输出为右侧 activity panel 专用的 `WorkspaceSessionActivityViewModel`
- 原因：这样旧链路继续只服务旧 UI，新链路独立演进，符合“新功能新代码”的边界要求。

### Decision 2: 旧逻辑只作为 facts provider，不承担新聚合职责

- 选择：保留现有 `useStatusPanelData` 作为“单线程局部摘要提取器”，不直接在其内部塞入 workspace 多 session 聚合分支。
- 原因：`useStatusPanelData` 现在服务 composer/status panel，强行扩写会把单线程摘要器变成多场景混合器，后续维护会迅速失控。
- 适配方式：必要时把其中稳定的解析函数下沉到 shared util，或由新 adapter 组合调用，而不是反向把 workspace 概念注入旧 hook。

### Decision 3: session 归属基于 `threadParentById`，而不是猜测 message 内容

- 选择：主从 session 关系以 `threadParentById` 为准，补充使用 thread linking 现有逻辑生成的父子链。
- 原因：仓库里已经有 `useThreadLinking` 和 `setThreadParent`，说明产品内已经存在线程亲缘关系治理。新面板应消费它，而不是用文案、tool 标题或 sender 文本去猜。
- 结果：右侧 panel 可以稳定回答“这条命令来自主 session 还是某个派生子 session”。

### Decision 3.5: 聚合范围锁定为 active thread 的 root subtree

- 选择：相关 session 集固定为“当前 active thread 追溯到 root thread 后，该 root 在当前 workspace 内的整棵 descendant subtree”。
- 原因：这能覆盖 AI 自拉起的子 session / 子 agent，又避免把同 workspace 内其他无关任务线程混进时间线。
- 结果：聚合是 workspace-scoped，但不是 workspace-wide flood；上下文边界稳定，可预测。

### Decision 3.6: `threadParentById` 缺失允许 fallback，但必须显式标记

- 选择：当 `threadParentById` 缺失时，允许使用现有 thread linking 元数据做 fallback 纳入相关 session 集。
- 约束：凡是通过 fallback 纳入的 session，view model 中必须带显式 provenance 标记，例如 `relationshipSource: "fallbackLinking"`。
- 原因：产品要尽量不断流，但也不能把“推断出的归属”伪装成“确定归属”。
- 结果：聚合具备韧性，同时保留后续补齐关系元数据的诊断空间。

### Decision 4: 右侧新增独立 tab 和独立组件树

- 选择：在 `PanelTabs` 中新增独立 tab，例如 `activity`，并在 `useLayoutNodes` 中新增独立的 `WorkspaceSessionActivityPanel` 挂载分支。
- 原因：右侧现有 panel 体系已经成熟，扩一个 tab 的改动面最小；同时新组件树与 Git/Files/Search/Memory 保持并列，不污染旧面板。

### Decision 4.1: 若采用 `SOLO` 模式，则它是 view mode，不是执行锁定模式

- 选择：`SOLO` 只定义为承载 activity 监控的视图模式，不改变 session 本身的执行语义。
- 入口：建议使用显式按钮进入，而不是根据执行状态自动强切。
- 退出：用户在 session 运行中必须可以切回普通视图。
- 恢复：再次进入 `SOLO` 时，应恢复当前任务的 activity 上下文，而不是重置。
- 原因：如果把 `SOLO` 做成近似 modal lock，用户很容易在运行中失去自主导航能力。

### Decision 4.5: 默认视图采用 timeline-first，session group 作为辅助

- 选择：activity panel 默认显示统一时间线，session 分组仅作为辅助筛选或折叠视图。
- 原因：用户此处的首要问题是“刚刚发生了什么、现在进展到哪”，时间线比先按 session 切分更符合扫描路径。
- 结果：面板默认信息架构优先按时间组织，再通过来源标签表达 session 归属。

### Decision 4.6: 命令明细只做轻展开，不复刻完整 console

- 选择：右侧命令事件允许轻量展开最近少量输出，用于判断是否卡住、是否报错；完整输出仍跳转到既有 tool card 或 runtime console。
- 原因：如果在右侧复刻完整输出，activity panel 会迅速膨胀成第二个 console，违背边界。
- 结果：activity panel 提供进展感知，不承担完整日志承载职责。

### Decision 4.7: 事件范围以可执行事实为主，explore 独立分类

- 选择：第一阶段时间线以 `command`、`task`、`fileChange` 三类事件为主，同时允许 `explore` 作为独立分类展示。
- 原因：`reasoning` 仍然会让右侧面板退化成第二个幕布，但 `explore` 已经形成稳定的操作轨迹，直接丢弃会损失上下文，伪装进 `command` / `task` 又会污染统计。
- 结果：activity panel 既保留探索路径，又维持执行事实分类的稳定性，扫描路径与统计口径都更清晰。

### Decision 5: 老代码只允许“最小适配”，不允许“顺手翻修”

- 选择：如果旧代码必须改，只允许两类改动：
  - 暴露新 adapter 所需的只读输入
  - 提取可复用的纯函数到 shared util
- 禁止：
  - 把 workspace 聚合逻辑写进 `StatusPanel`
  - 把右侧面板渲染逻辑写进 `Messages`
  - 为新面板去重做 `thread reducer` 状态结构

## Architecture

### High-level shape

```text
Thread State / Realtime Facts
  ├─ itemsByThread
  ├─ threadStatusById
  ├─ threadParentById
  └─ threadsByWorkspace
             │
             ▼
Workspace Session Activity Adapter   ← 新增
  ├─ find relevant session tree
  ├─ normalize command/task/file-change events
  ├─ merge and sort timeline
  └─ build panel view model
             │
             ▼
WorkspaceSessionActivityPanel        ← 新增
  ├─ toolbar / filters
  ├─ session groups
  ├─ activity timeline cards
  └─ jump actions
```

### New modules

- `src/features/session-activity/hooks/useWorkspaceSessionActivity.ts`
  - 负责多 session 聚合和 view model 生成
- `src/features/session-activity/components/WorkspaceSessionActivityPanel.tsx`
  - 负责右侧面板 UI
- `src/features/session-activity/utils/*`
  - 负责 event normalization、排序、分组、标签推导
- `src/features/session-activity/adapters/buildWorkspaceSessionActivity.ts`
  - 负责把 thread facts 转成面板消费的纯数据模型，供 hook 与测试共同复用

### Existing modules kept stable

- `src/features/status-panel/hooks/useStatusPanelData.ts`
- `src/features/status-panel/components/StatusPanel.tsx`
- `src/features/messages/components/toolBlocks/*`
- `src/features/threads/hooks/useThreadsReducer.ts`

## Data Flow

### Step 1: determine relevant session set

输入当前 `workspaceId` 与当前 active thread。

新 adapter 需要：

1. 找到 active thread
2. 通过 `threadParentById` 向上追溯 root session
3. 在当前 workspace 线程集中找到该 root 下的所有 descendant threads
4. 得到本次监控的 `relevantThreadIds`

这一步只读消费现有状态，不修改任何旧结构。

若 `threadParentById` 局部缺失，只允许使用现有 thread linking 元数据做只读 fallback；不得通过解析消息文案或 tool 标题猜测归属。凡是 fallback 命中的 thread，必须在 view model 中打上显式来源标记。

### Step 2: normalize per-thread activity

对每个 relevant thread：

1. 读取 `itemsByThread[threadId]`
2. 提取：
   - command events
   - todo / plan / subagent events
   - file change events
3. 读取 `threadStatusById[threadId]`
4. 补上 session label、processing state、heartbeat、来源 threadId

这里不直接复用 `StatusPanel` 组件，而是复用其“解析思想”。如果确有稳定纯函数可抽，就抽到 shared util；否则新 adapter 自己解析，避免牵一发而动全身。

### Step 3: build merged workspace timeline

将所有 thread 的 normalized events 合并为一条时间线：

- 默认按事件时间倒序或正序展示
- 支持按 session 分组查看
- 每条 event 都带：
  - `eventId`
  - `threadId`
  - `sessionRole`（root / child）
  - `relationshipSource`（directParent / fallbackLinking）
  - `kind`（command / task / fileChange）
  - `summary`
  - `status`
  - `jumpTarget`

建议的纯数据结构：

```ts
type WorkspaceSessionActivityViewModel = {
  rootThreadId: string;
  relevantThreadIds: string[];
  timeline: SessionActivityEvent[];
  sessionSummaries: SessionActivitySessionSummary[];
  isProcessing: boolean;
  emptyState: "idle" | "running" | "completed";
};
```

```ts
type SessionActivityEvent = {
  eventId: string;
  threadId: string;
  sessionRole: "root" | "child";
  relationshipSource: "directParent" | "fallbackLinking";
  kind: "command" | "task" | "fileChange";
  occurredAt: number;
  summary: string;
  status: "running" | "completed" | "failed" | "pending";
  jumpTarget?: {
    type: "thread" | "message" | "diff" | "runtime";
    id: string;
  };
};
```

## UI Boundaries

### Right panel only

新面板只存在于右侧 panel 区域，不进入：

- composer 底部 status panel
- message curtain
- runtime console

如果后续产品决定用 `SOLO` 作为更高阶承载形态，则 `SOLO` 与普通 chat canvas 之间必须是可逆切换关系，而不是互斥执行态。

### Adapter boundary

新面板不得直接依赖旧 UI 组件输出 HTML 或 JSX。  
新面板只消费 adapter 输出的纯数据 view model。

### Jump integration

新面板与老能力的关系是“跳转复用”，不是“内嵌替代”：

- 查看文件修改：跳到现有 diff / file view
- 查看命令输出：跳到已有 tool card 或 runtime console
- 查看任务细节：跳到对应线程或对应消息位置

### Auto-open file consideration

“文件正在被实时修改时自动打开文件并让用户看到编辑效果”是一个很强的演示型交互，但它已经不只是 activity panel 的信息展示，而是会反向驱动 editor/file view。

当前建议：

- 本提案先不把“自动打开文件”设为默认行为
- 可以保留为后续增强项，条件是：
  - 仅对当前 active task 的 file-change event 生效
  - 必须可关闭
  - 不得抢占用户当前手动打开的上下文
  - 不得因频繁切换文件造成界面抖动

原因：

- activity panel 的主目标是“观测”，自动打开文件属于“主动编排界面”
- 如果直接写进第一版，会把面板和 editor surface 强耦合，破坏你要求的 adapter 边界
- 这更像第二阶段 capability：`live edit preview`，建议后续单独提

## Risks / Trade-offs

- [Risk] 新 adapter 和旧摘要逻辑逐渐分叉，出现同事实不同摘要  
  → Mitigation: 将摘要规则抽成 shared pure helpers，只共享规则，不共享 UI

- [Risk] 直接改旧 hook 图省事，导致 status panel 回归  
  → Mitigation: 在任务和实现门禁中明确“旧 hook 只允许最小适配，不允许混入 workspace 聚合”

- [Risk] thread parent 关系不完整，导致子 session 漏聚合  
  → Mitigation: 先基于 `threadParentById`，缺口通过 adapter fallback 和补充 linking 测试处理

- [Risk] 多 session 时间线过于嘈杂  
  → Mitigation: 面板默认展示关键事件卡片，并保留 session 分组/筛选能力

- [Risk] 若 `SOLO` 进入后无法在运行中退出，会被用户感知为“界面劫持”  
  → Mitigation: 明确 SOLO 是 view mode；退出不影响 session 执行，重新进入恢复上下文

## Migration Plan

1. 新增 `session-activity` 独立模块
2. 实现 workspace session activity adapter
3. 在右侧 panel tabs 中接入新 tab
4. 用新 panel 消费 adapter view model
5. 只在必要处对旧代码做“只读接口暴露 / 纯函数抽取”
6. 补回归测试，证明旧面板和消息区零回退

## Implementation Notes From Current Codebase

基于当前代码现状，第一阶段实现建议按这个顺序推进：

1. `src/features/session-activity/*`
   - 先落独立 adapter、hook、view model 类型和测试
   - 直接消费 `useThreads` 暴露的 `threadItemsByThread`、`threadParentById`、`activeThreadIdByWorkspace`、`threadsByWorkspace`

2. `src/features/layout/components/PanelTabs.tsx`
   - 新增 `activity` tab id 和 icon
   - 保持现有 tab 体系不变，不把 activity 特判塞进其他 panel

3. `src/features/layout/hooks/useLayoutNodes.tsx`
   - 作为右侧 panel 的唯一挂载点接入 `WorkspaceSessionActivityPanel`
   - 只把所需 facts 传给新 hook / panel，不在这里实现聚合逻辑

4. `src/features/status-panel/hooks/useStatusPanelData.ts`
   - 只允许抽取纯解析 helper
   - 不允许把 workspace 多 session 聚合逻辑写回这个 hook

5. `src/features/threads/hooks/useThreadLinking.ts`
   - 只作为 fallback provenance 的事实来源
   - 不在这里为 activity panel 引入反向 UI 耦合

## Validation

- 验证 1：active thread 拉起 child thread 后，右侧面板能聚合两者活动
- 验证 2：删除 / 切换 thread 不会污染其他 workspace 的聚合结果
- 验证 3：旧 `StatusPanel` 行为不变
- 验证 4：旧 `toolBlocks` 渲染不变
- 验证 5：Git / Files / Search / Memory tabs 不回退
- 验证 6：若存在 `SOLO` 入口，运行中切回普通视图不会中断 session 执行
- 验证 7：重新进入 `SOLO` 后能恢复当前任务的 activity 上下文

## Spec Mapping

- `specs/codex-chat-canvas-workspace-session-activity-panel/spec.md`
  - 新 capability，定义右侧多 session 面板主契约
- `specs/conversation-tool-card-persistence/spec.md`
  - 补充 tool card 与 activity panel 的摘要/跳转一致性
- `specs/codex-chat-canvas-execution-cards-visual-refactor/spec.md`
  - 补充 Codex 执行摘要规则在三处视图的共享约束

## Open Questions

- 是否要单独立项做 `live edit preview`，让 file-change event 驱动右侧 editor/file view 自动打开并展示实时编辑效果
