## Context

当前文件浏览能力由两块松散耦合的实现组成：

- 主窗口右侧 panel 通过 `useLayoutNodes` 直接挂载 `FileTreePanel`。
- 中央文件查看区通过 `useGitPanelController` 持有 `openFileTabs`、`activeEditorFilePath`、`editorNavigationTarget`，再由 `FileViewPanel` 渲染。

这套结构适合“右侧辅面板 + 中央编辑区”的单窗口交互，但不适合额外弹出一个独立文件管理窗口。原因有三个：

1. 文件轮询现在依赖 `src/app-shell.tsx` 中 `filePanelMode === "files"` 且右侧 panel 可见，说明文件列表生命周期被绑定在主窗口布局状态上。
2. 文件树和文件查看虽然组件上已经拆开，但编排状态分散在 `useGitPanelController`、`useLayoutNodes`、`AppShell`，没有一个可以复用于第二个窗口的“文件工作区控制器”。
3. 当前路由只对 `main` 和 `about` 两个 window label 做特殊处理，缺少为独立文件浏览窗口提供专属 render path 的能力。

这次设计需要在不破坏主窗口右侧文件面板的前提下，新增一个辅助性的独立文件管理窗口，并把文件浏览状态组织成窗口内自洽、窗口间低耦合的结构。

## Goals / Non-Goals

**Goals:**

- 保留主窗口右侧文件管理面板的现有能力与入口。
- 新增一个可从右侧文件面板打开的独立文件管理窗口。
- 独立窗口内支持工作区级文件树浏览、文件打开、标签切换和右侧内容查看。
- 让独立窗口拥有自己的文件浏览状态，不依赖主窗口 `centerMode`、`rightPanelCollapsed`、`filePanelMode`。
- 抽取共享的文件浏览编排层，避免复制两套 `FileTreePanel + FileViewPanel` 粘贴实现。

**Non-Goals:**

- 不在本次设计中支持多个 detached file explorer window 并行打开。
- 不把主窗口右侧文件面板迁移成独立窗口，也不删除任何现有文件入口。
- 不在本次设计中统一主窗口与独立窗口的“打开标签页”历史，两个 surface 的编辑上下文彼此独立。
- 不改造 Git、Spec Hub、Prompt、Search 等右侧其他 panel 的架构。

## Decisions

### 1. 采用“保留嵌入式 surface + 新增单个 detached surface”的窗口模型

系统新增一个固定 label 的辅助窗口 `file-explorer`，它是文件管理能力的第二个 surface，而不是主窗口右侧 panel 的替代品。用户从右侧文件树根行点击 detach icon 时：

- 如果窗口不存在，则新建 `file-explorer`。
- 如果窗口已存在，则聚焦该窗口，并将其工作区上下文切换到当前工作区。

之所以采用“单个固定 detached 窗口”而不是“每个 workspace 一个窗口”：

- 现有 `router.tsx` 只基于 window label 切换视图，固定 label 最简单、最稳定。
- 用户需求是“额外弹出一个整体面板”，并没有要求多窗口矩阵。
- 单窗口模型能显著降低跨窗口同步、窗口回收、菜单与测试复杂度。

备选方案：

- 每个 workspace 一个独立窗口：灵活，但窗口管理和状态清理复杂度显著升高。
- 完全复用 `open_new_window` 打开第二个完整 AppShell：实现快，但会把聊天、Git、Spec 等无关负载一起带进来，违背隔离目标。

### 2. 新增专属 window route，而不是在 `AppShell` 中塞条件分支

`router.tsx` 将扩展为识别 `file-explorer` label，并渲染新的 `DetachedFileExplorerWindow` 根组件。这个根组件只负责文件管理窗口，不复用 `AppShell` 的整体布局壳。

这样做的原因：

- 独立窗口不需要 sidebar、composer、messages、plan panel。
- 将窗口路由切在最外层，能避免 `AppShell` 出现大量 `if (windowLabel === "...")` 分支。
- 后续如果还有独立辅助窗口，路由模型可继续复用。

备选方案：

- 在 `AppShell` 内部根据 label 隐藏无关区域：短期能跑，但会把主窗口状态和独立窗口状态强行绑在一起，维护成本高。

### 3. 定义显式的 detached window 协议，而不是把上下文切换写成隐式副作用

除了新增 route，本次还需要把 detached window 的创建与复用语义写成一个明确协议。协议包含四部分：

- `windowLabel`: 固定为 `file-explorer`，全局最多存在一个实例。
- `sessionPayload`: 至少包含 `workspaceId`、`workspacePath`、`workspaceName`、`updatedAt`，可选 `initialFilePath`。
- `openOrFocus`: 若窗口不存在则创建；若已存在则聚焦并接受最新 payload。
- `retarget`: 当主窗口从另一 workspace 再次执行 detach 时，现有 detached window 必须切换到新的 workspace，而不是静默忽略。

之所以要把这些语义写明，而不是仅在实现中“顺手处理”：

- 当前已有 `open_new_window` 能力，但其契约更像“开一个新壳”，并不是“按 label 复用单例工作窗口”。
- detached window 的核心复杂度不是 render，而是“同一个辅助窗口在冷启动、复用、热切换、关闭再打开时行为必须一致”。
- 明确协议后，前端 route、Tauri command、窗口事件和测试用例才能围绕同一组状态机收敛。

协议状态机可以抽象为：

`Closed -> Opening -> Active(workspace A) -> Retargeting(workspace B) -> Active(workspace B) -> Closed`

其中 `Opening` 依赖持久化快照兜底，`Retargeting` 依赖实时事件驱动，任何重复 detach 都不能进入第二个并行窗口分支。

### 4. 抽取共享的 `FileExplorerWorkspace` 组合层，主窗口与独立窗口分别挂自己的控制器

现有 `FileTreePanel` 与 `FileViewPanel` 会继续保留，但新增一层共享组合：

- `FileExplorerWorkspace`：纯组合容器，负责左树右编辑器布局。
- `FileTreeSurface`：只处理文件树本体、选择、展开、拖拽和工作区根行区域。
- `FileTreeRootActions`：承载 detach/focus、主窗口专属工具条、workspace root 级动作。
- `useFileExplorerWorkspaceState`：窗口内状态控制器，持有 `openTabs`、`activeFilePath`、`navigationTarget`、`editorHighlightTarget`、`fileReferenceMode` 等文件浏览局部状态。
- `useDetachedFileExplorerSession`：负责 detached 窗口的 workspace 上下文接入、窗口标题、事件同步和关闭/恢复动作。

主窗口继续通过现有 `useGitPanelController` 管理自己的中央编辑区；独立窗口使用新的文件控制器，不接入 `centerMode`、`gitPanelMode`、`filePanelMode`。

这样拆分的关键价值是把“文件浏览状态”从“主窗口布局状态”里拔出来，但不强迫主窗口立即改用全新控制器。换句话说，本次是增量抽象，不是一次性重写。

这里有一个必须写明的边界：`FileTreePanel` 现状承载了不止文件树，还牵连主窗口特有的 open app、Spec Hub、runtime console 等行为。为了避免 detached window 复用时把这些语义一起带过去，本次共享层只复用“文件浏览核心能力”，主窗口装饰能力必须留在主窗口侧组合层。

备选方案：

- 复制一套 `FileTreePanel` / `FileViewPanel` 到 detached 目录下：实现快，但两边行为会立即开始分叉。
- 强行让主窗口和 detached 共用同一个全局控制器：会引入抢占焦点、互相覆盖标签页、难以测试的问题。

### 5. detached 窗口的工作区上下文通过“持久化快照 + 实时事件”同步

独立窗口启动和更新上下文时，使用两层同步机制：

- 持久化快照：将最新 detached session 写入 client storage，例如 `app.detachedFileExplorerSession`，包含 `workspaceId`、`workspacePath`、`workspaceName`、可选 `initialFilePath`、`updatedAt`。
- 实时事件：主窗口打开或切换 detached 窗口时，向 `file-explorer` 发送事件，驱动窗口立即切换到目标工作区。

选择双通道而不是只用其中一个的原因：

- 只用事件，窗口冷启动时容易丢第一次上下文。
- 只用 storage，已打开窗口切换 workspace 时响应不够及时。
- 两者结合可以同时覆盖冷启动与热切换。

### 6. 文件列表轮询按窗口本地可见性独立运行，不再依赖主窗口右侧 panel 是否展开

独立窗口将直接使用 `useWorkspaceFiles`，但 polling 开关由 detached 窗口自身决定，而不是继续复用 `!rightPanelCollapsed && filePanelMode === "files"` 这一条件。主窗口原有轮询逻辑保持不变。

这意味着两个 surface 在同一 workspace 并存时会存在双轮询风险。缓解方式：

- detached 窗口只在该窗口处于激活或可见状态时保持 active polling。
- 主窗口保留现有节流与退避逻辑。
- 这次不做跨窗口共享缓存，先用简单、清晰、可回退的双实例模型落地。
- 把双轮询视为一期允许的折中，并显式观测 `files/list` 请求频率、耗时和失败退避是否仍处于可接受区间。

备选方案：

- 建立跨窗口共享文件缓存服务：理论更省 IO，但要新增全局状态源和失效机制，超出本次范围。

### 7. 用户动作语义采用“Detach / Focus / Close”，不定义真正的窗口级 reattach

主窗口根行 icon 的职责是 detach 或聚焦 detached 窗口。detached 窗口内提供 close 动作，用于关闭辅助窗口并回到仅使用主窗口的工作流。

本次不实现物理意义上的“把 detached 窗口再插回主窗口”窗口级动画或 docking，因为：

- 主窗口右侧面板本来就保留，没有真正需要“插回”的内容迁移。
- 关闭 detached 窗口即可恢复单 surface 模式，语义已经完整。

因此在文案和交互上，主窗口侧强调 `Open Detached Explorer`，独立窗口侧强调 `Close Detached Explorer` 或 `Focus Main Window`，避免制造假的 docking 预期。

### 8. 验证门禁以“窗口协议 + 状态隔离 + 可见性 polling”为中心

本次验证不能只看 render 成功或组件快照，因为最容易回归的是窗口协议与状态边界。最低验证门禁应覆盖三类能力：

- 窗口协议：重复 detach 不创建第二个窗口；已有窗口会被 focus；从另一 workspace detach 会 retarget。
- 状态隔离：detached window 内部打开/关闭标签不会覆盖主窗口 editor session；主窗口 editor 行为也不会回写 detached session。
- polling 边界：detached window 在不可见或失焦时降级 polling；恢复可见后能重新拉起；主窗口原有文件 panel 行为保持兼容。

如果这些门禁没有被测试覆盖，就算 UI 可用，仍然不足以证明该提案完成。

### 9. 独立窗口补齐 Git 装饰与 diff 配色语义，避免双 surface 认知断层

当前用户反馈已经明确暴露一个体验裂缝：主窗口右侧文件树具备 Git 状态装饰，而独立文件窗口树缺失同等装饰；同时独立窗口打开文件后缺少 diff 语义配色，导致“同一工作区、不同入口、不同语义”的割裂感。

本次新增能力采用“语义复用优先”的策略，而不是在 detached 窗口内重新定义一套视觉规则：

- 文件树 Git 装饰复用与主窗口同源的数据契约（文件状态枚举、颜色映射、图标语义），禁止在 detached 侧再维护一套状态到样式的私有分支。
- 文件查看区 diff 配色复用现有 diff token/line decoration 规则，确保新增、删除、修改、上下文行在两个 surface 呈现一致。
- 若 detached 侧为性能做了轻量渲染降级，必须保持语义不降级：可以降低动画或细节，但不能丢失状态类别和颜色含义。

边界说明：

- 本次只要求“语义对齐”，不强制像素级完全一致；允许布局密度、边距等窗口级差异存在。
- 不新增第三套主题变量，继续复用现有 Git/diff 颜色 token，避免主题维护成本扩张。

## Risks / Trade-offs

- [双窗口轮询同一 workspace 带来额外 IO] → 先使用窗口本地可见性控制与现有 backoff；如果后续仍有明显性能问题，再补共享缓存层。
- [文件浏览控制器抽象过度，导致主窗口接入成本上升] → 本次只抽公共组合层，不强行重写主窗口现有 `useGitPanelController`。
- [窗口上下文同步丢失，导致 detached 窗口打开空白] → 使用 storage snapshot 作为冷启动兜底，事件只负责热更新。
- [用户误解为“右侧入口会消失”] → 规格和文案统一明确为新增能力，嵌入式右侧文件管理保持可用。
- [独立窗口与主窗口文件标签不同步，用户感到不一致] → 在设计中明确这是有意隔离；两个 surface 共享工作区，不共享编辑会话。
- [共享层抽象时误把主窗口专属动作一并下沉] → 将 root actions 与文件树核心能力拆开，防止 detached window 被动继承主窗口杂项入口。
- [单例窗口协议在 Tauri command 与前端 route 间不一致] → 以固定 label 和统一 session payload 为协议中心，测试直接覆盖 open/focus/retarget 三种路径。

## Migration Plan

1. 新增 detached file explorer window 的创建能力与 window route。
2. 抽取共享的文件浏览组合层，并实现 detached 窗口专用控制器。
3. 在 `FileTreePanel` 根行加 detach/focus icon，并接入 detached session 同步。
4. 为 detached 窗口接入 `useWorkspaceFiles`、`FileViewPanel`、关闭动作与标题更新。
5. 补充主窗口/独立窗口并存、上下文切换、关闭恢复、路由渲染和 polling 行为测试。
6. 若发布后需要回滚，只需移除 detached window 创建入口和 route，右侧原文件面板不受影响，属于低风险回退。

## Open Questions

- None.
