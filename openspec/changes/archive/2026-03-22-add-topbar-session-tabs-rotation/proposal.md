## Why

当前 chat canvas 在多会话并行时，用户主要依赖左侧线程树或右侧 activity/radar 做会话切换；当幕布处于持续阅读与追问状态时，切换路径偏长、上下文打断明显。需要在客户端主 topbar 提供“就近会话切换”能力，并用固定上限控制视觉复杂度。

## 提案补充（验收版）

以下为 2026-03-22 的验收补充条款；若与下文旧描述冲突，以本节为准：

- topbar 会话窗口改为**跨 workspace 全局轮转**，不再按 workspace 隔离。
- 轮转上限改为 `max=4`，并继续保持 active tab 不被淘汰。
- tab 高亮与切换上下文以 `workspaceId + threadId` 作为唯一键，避免跨项目同名/同 ID 场景高亮错位。
- tab 文本策略调整为：超过 7 个字后显示 `...`。
- 每个 tab 提供 `X` 关闭入口；关闭仅移出 topbar 窗口，不删除 thread、不终止会话。
- tabs 视觉调整为紧密连接按钮组（直角），并移除 tab 组外边框。

## 客观性评估口径（Objective Rubric）

- 评估范围（固定）：
  - desktop workspace chat；
  - 用户已进入会话阅读/追问状态；
  - 目标是切换到“已存在且可解析”的其他 thread。
- 基线动作模型（现状）：
  - 侧栏路径：`展开侧栏 -> 定位 thread -> 点击 thread`（3 步）。
  - 右侧路径：`切换到 activity/radar -> 点击 thread`（2 步）。
- 目标动作模型（本提案）：
  - topbar 路径：`点击目标 tab`（1 步）。
- 量化验收指标（必须可证伪）：
  - `M1` 路径步数：在评估范围内，切换路径 `median <= 1` 且 `p90 <= 1`。
  - `M2` 生命周期副作用：tab 切换触发的“新建会话/新建 thread”调用次数必须为 `0`。
  - `M3` 布局可操作性：窗口宽度 `1280/1024/800` 三档下（应用最小宽度为 `800`），tabs 与核心操作按钮必须可点击。
  - `M4` 平台兼容性：Win/mac 下窗口控制区保持可点击，tab 点击事件不可被 drag region 吞掉。
- 证据要求：
  - 单测覆盖 `M1/M2`；
  - 布局回归与命中区检查覆盖 `M3/M4`；
  - 验证记录写入本变更验证产物。

## What Changes

- 在主 topbar（项目标题区与右侧操作区之间）新增 `Opened Session Tabs` 区域，用于展示跨 workspace 的“已激活（最近激活）”会话。
- 会话 tabs 采用固定 `max=4` 的轮转策略（rotation window）：
  - 新会话进入时追加到窗口尾部；
  - 超出 4 个时按最近激活顺序淘汰最旧且非当前激活的 tab；
  - 当前激活会话 MUST 保持可见，不可被本轮淘汰。
- 轮转窗口打破 workspace 隔离，统一维护全局 `max=4` 会话窗口。
- “激活会话”定义：仅当会话通过现有 thread 选择链路成为 active thread 后，才进入 topbar tabs 轮转窗口。
- 点击 tab SHALL 直接切换到对应 thread，不改变会话生命周期语义（不创建新会话、不终止后台执行）。
- tab 文本截断规则：会话文本超过 7 个字后 MUST 显示 `...`。
- 每个 tab MUST 提供 `X` 关闭能力，且关闭动作仅作用于 topbar 可见窗口，不改变 thread 生命周期。
- tab 组视觉 MUST 为紧密直角按钮组，并移除组外边框（仅保留按钮之间分隔语义）。
- Phase 1 明确不默认引入 overflow 入口（如 `+N`）；超过 4 个会话时仅保留主可见窗口轮转语义，额外会话通过既有 sidebar/radar 回切。
- 失效会话清理：当 thread 被删除、归档或不可解析时，对应 topbar tab MUST 被移除，不得残留失效入口。
- Phase 1 状态边界：tabs 轮转窗口为运行时本地状态，应用重启后不做持久化恢复，按后续激活行为重新构建。
- 在侧栏收起/展开、right panel 收起/展开、窗口缩放等场景中，topbar tabs MUST 保持可读与可点击，不挤压既有核心操作按钮。
- 保持现有 `MainHeader` 项目切换、分支菜单、运行/终端/solo 等操作链路不回退。
- 保持现有 sidebar 线程树、right panel 的 `activity/radar` 聚合与切换语义不回退。

## 目标与边界

### 目标

- 将高频会话切换动作前置到 topbar，减少“侧栏展开-定位线程-切换”的路径成本。
- 在不引入新状态机的前提下，提供稳定可预期的“4 槽轮转”可见性模型。
- 与现有 workspace/chat 结构兼容，保持 UI 信息架构清晰（标题、会话、操作三段式）。

### 边界

- 第一阶段仅覆盖 desktop workspace chat 场景（`MainTopbar`）；不改 phone/tablet 的导航结构。
- 只定义“已打开会话的展示与切换”，并引入跨 workspace 全局轮转窗口。
- 不改变后端会话存储与线程协议，轮转窗口状态仅作为前端视图状态管理。
- 严格零回归边界：本变更仅新增 topbar 会话 tabs 展示层，MUST NOT 改写现有会话生命周期、发送链路、sidebar/radar/activity 语义与线程排序主逻辑。
- 平台边界：MUST 保持 Win/mac titlebar 交互兼容（窗口控制区、拖拽区、点击命中区）不回退。

## 非目标

- 不实现浏览器式无限 tab 管理（固定/拖拽重排/分组着色等高级功能）。
- 不在本提案内新增会话 pin、批量关闭、跨工作区拖拽。
- 不替换现有侧栏线程树与 radar/activity 面板职责。

## 技术方案对比

### 方案 A：无限 tab + 横向滚动

- 优点：信息完整，不丢任何已打开会话。
- 缺点：topbar 可扫描性差，缩放与窄宽度下操作区容易被压缩，交互噪声高。

### 方案 B：固定 4 槽轮转窗口（推荐）

- 优点：认知负担低、视觉稳定；满足高频“最近会话切换”；与现有 topbar 空间预算兼容。
- 缺点：需要定义淘汰与回找规则（通过最近激活顺序 + 可选 overflow 缓解）。

### 方案 C：不加 topbar tabs，仅强化侧栏/快捷键

- 优点：实现成本最低。
- 缺点：无法解决“阅读幕布时就近切换”的核心痛点，收益不足。

### 客观评分矩阵（5 分制，分数越高越优）

| 维度 | 权重 | 方案 A 无限滚动 | 方案 B 4 槽轮转 | 方案 C 不新增 topbar |
|---|---:|---:|---:|---:|
| 痛点命中度（阅读态就近切换） | 40% | 3 | 5 | 1 |
| topbar 稳定性（窄宽度与可扫描性） | 25% | 1 | 4 | 5 |
| 回归风险（高分=低风险） | 20% | 2 | 3 | 5 |
| 实现复杂度（高分=更简单） | 15% | 2 | 4 | 5 |
| **加权总分** | **100%** | **2.15** | **4.20** | **3.40** |

### 取舍

采用 **方案 B（固定 4 槽轮转）**。在保证 topbar 稳定布局与操作可达性的前提下，最小改动获得最大切换效率提升。

## 验收标准

- 在 workspace chat 中打开并切换多个会话时，topbar MUST 显示会话 tabs，且可点击跳转。
- 当打开第 5 个会话时，主可见 tabs MUST 维持 4 个并按轮转规则淘汰最旧非激活项。
- 当前激活会话在任意时刻 MUST 出现在主可见 tabs 内。
- 当多个“最旧且非 active”候选并列时，系统 MUST 按 `activationOrdinal` 升序淘汰；若序号异常相同，MUST 按 `threadId` 字典序兜底，保证行为确定性。
- tab 文案 MUST 优先使用 `thread.title`；当标题为空或不可解析时，MUST 回退为本地化 `Untitled Session` + `shortThreadId`。
- tab 文案展示长度 MUST 在超过 7 个字时截断为 `...`，并通过 tooltip/aria 暴露完整文案。
- 每个 tab MUST 提供 `X` 关闭入口，且关闭行为 MUST NOT 删除 thread、MUST NOT 中断会话运行。
- tab 组 MUST 移除外边框并保持按钮紧密连接（直角样式）。
- 会话切换后，消息区、composer、右侧面板上下文 MUST 与目标 thread 一致，不产生额外新会话。
- 在窗口宽度 `>=1024px` 时，侧栏折叠/展开与 right panel 折叠/展开组合下，topbar tabs 与既有操作按钮 MUST 保持可点击，不出现覆盖或裁剪。
- 在窗口宽度 `800px~1023px`（最小宽度区间）时，active tab MUST 保持可见，且运行/终端/solo 等核心操作按钮命中区 MUST 不小于 `28x28px`。
- 现有项目标题迁移规则与主 topbar 操作区行为 MUST 不回退。
- Win/mac 平台下，tabs 区域 MUST 不遮挡窗口控制按钮，且 tabs 点击命中区 MUST 不被 drag region 吞掉。
- 回归门禁 MUST 覆盖“无 tabs 时 UI 行为与当前版本一致”场景。
- phone/tablet MUST 不渲染该能力，保持当前导航结构与交互语义不变。
- Phase 1 MUST 不引入新的 overflow 菜单交互。
- 未被激活过的 thread MUST 不进入 topbar tabs 窗口。
- thread 删除/归档后，对应失效 tab MUST 被清理，且系统 MUST 保持可交互（无崩溃/无死链）。
- 应用重启后，topbar tabs 窗口 MUST 为空并按新激活事件重建。
- 跨 workspace 场景下，topbar MUST 允许会话同窗轮转，并保持高亮/切换上下文准确。

## Capabilities

### New Capabilities

- `workspace-topbar-session-tabs`: 定义 workspace chat 顶部会话 tabs 的展示、激活切换、4 槽轮转、关闭入口与可见性约束。

### Modified Capabilities

- `workspace-sidebar-visual-harmony`: 扩展主 topbar 组合规则，要求在标题迁移与操作区稳定前提下容纳会话 tabs 区域并保持布局连续性。

## Impact

- Affected frontend modules（预期）:
- `src/features/layout/hooks/useLayoutNodes.tsx`
- `src/features/app/components/MainTopbar.tsx`
- `src/features/app/components/MainHeader.tsx`
- `src/app-shell-parts/renderAppShell.tsx`
- `src/styles/main.css`
- `src/styles/sidebar.css`
- `src/i18n/locales/zh.part1.ts`
- `src/i18n/locales/en.part1.ts`
- Testing/verification scope（预期）:
- topbar 会话轮转策略单测（max=4、激活项保留、淘汰顺序、关闭行为）
- 会话切换回归测试（workspace/thread 上下文一致）
- 布局回归测试（侧栏/右侧面板折叠与窄宽度可点击性）
