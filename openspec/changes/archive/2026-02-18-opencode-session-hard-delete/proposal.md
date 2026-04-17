# Proposal: UX 交互调整 — OpenCode 删除 & 看板交互修复

## Why

当前存在三个 UX 交互缺陷：

### 问题 1: OpenCode 会话无法删除

点击删除按钮后 UI 直接弹出"引擎不支持删除"（`ENGINE_UNSUPPORTED`）错误提示。`useThreadActions.ts` 中 OpenCode 线程的删除路径被硬编码为
`throw Error`，而 Claude 和 Codex 均已具备完整的后端删除能力。

- 用户无法清理不再需要的 OpenCode 会话，列表越积越多。
- 三大引擎的 UX 一致性被破坏。
- 与 `conversation-hard-delete` 规范矛盾。

### 问题 2: 看板 Trigger Icon 无选中态视觉反馈

Composer 底部的"关联项目看板"触发按钮（`.composer-kanban-trigger`），在用户选中某个看板后，icon 外观与未选中状态完全一致——仍为
`--text-muted` 灰色。用户无法从触发按钮上判断当前是否已关联看板。

- 根因：`Composer.tsx:1340` 的 trigger button 的 `className` 始终为 `"composer-kanban-trigger"`，未根据
  `selectedLinkedKanbanPanelId` 添加选中态类。
- CSS 中只有 `:hover` 态，缺少 `.is-active` 选中态样式。

### 问题 3: 看板 Popover 打开时点击区域导致 Popover 消失

当用户打开看板关联 popover 后，点击 Composer 输入区域（或任何 popover 外部区域）时，popover 立即关闭，导致用户无法在 popover
打开的同时与输入框交互。

- 根因：`ComposerContextMenuPopover` 使用全屏 backdrop（`position: fixed; inset: 0; z-index: 1190`），`onClick={onClose}`
  捕获所有 popover 外部点击，包括 Composer 主输入框的点击。
- 表现：用户打开 popover → 尝试在输入框输入文字 → 一点击输入框 popover 立即消失，焦点也未落在输入框上，造成操作中断。
- 影响范围：`ComposerContextMenuPopover.tsx:155`（backdrop onClick）

## 目标与边界

- 目标
    - **问题 1**：为 OpenCode 引擎实现后端文件级 hard delete 能力，使其与 Claude/Codex 的删除语义对齐。
    - **问题 2**：当看板已选中时，trigger button 显示深色选中态（border + text + icon 均加深），给用户明确的视觉反馈。
    - **问题 3**：看板 popover 打开时，点击 Composer 输入区域不关闭 popover，允许用户在两者之间自由切换。
- 边界
    - 问题 1 聚焦 OpenCode 删除能力补齐，不涉及 Claude/Codex 删除路径改动。
    - 问题 2 仅修改 trigger button 的选中态样式。
    - 问题 3 仅修改 kanban popover 的关闭策略，不影响其他使用 `ComposerContextMenuPopover` 的场景。

## 非目标

- 不改变 OpenCode 引擎的 CLI 集成方式。
- 不引入跨引擎统一的删除 RPC 抽象层。
- 不重新设计看板关联的整体 UI 布局。
- 不重写 `ComposerContextMenuPopover` 的通用交互逻辑（仅新增向后兼容的可选 prop）。

## What Changes

### 问题 1: OpenCode 删除

- **Rust 后端**：新增 `opencode_delete_session` Tauri Command（混合策略：CLI 优先 + 文件系统回退）。
- **前端 Hook**：`useThreadActions.ts` OpenCode 分支从 `throw Error` 改为调用后端删除。
- **前端 Service**：`tauri.ts` 新增 `deleteOpenCodeSession` IPC 调用。
- **错误映射**：复用 `ThreadDeleteErrorCode` 体系。

### 问题 2: 看板 Trigger 选中态

- **Composer.tsx**：trigger button 的 `className` 根据 `selectedLinkedKanbanPanelId` 动态添加 `is-active` 类。
- **composer.css**：新增 `.composer-kanban-trigger.is-active` 样式（深色 border、深色 text/icon）。

### 问题 3: 看板 Popover 关闭策略修复

- **ComposerContextMenuPopover.tsx**：新增 `closeOnBackdropClick?: boolean` 可选 prop，默认 `true`（保持现有调用方行为不变）。
- **Composer.tsx**：仅在 kanban popover 调用处传入 `closeOnBackdropClick={false}`，实现“点击外部不关闭”。
- 具体实现方案见 `design.md` Decision #5。

## 技术方案对比

### 问题 1

| 方案              | 描述                                        | 优点               | 风险/缺点     |
|-----------------|-------------------------------------------|------------------|-----------|
| A. 前端软删除        | 仅从 UI state 中移除                           | 零后端改动            | 磁盘残留；重启复活 |
| B. 后端文件删除       | Tauri Command 定位并删除文件                     | 真删除、语义一致         | 需探测存储路径格式 |
| **C. 混合策略（推荐）** | 优先尝试 `opencode session delete`，失败回退文件系统删除 | 兼容 CLI 生态演进且当前可用 | 实现略复杂     |

**取舍**：采用 **方案 C**。

### 问题 2

| 方案                         | 描述                              | 优点                                                     | 风险/缺点                 |
|----------------------------|---------------------------------|--------------------------------------------------------|-----------------------|
| **A. CSS is-active 类（推荐）** | 选中时添加 `.is-active` 类，CSS 定义深色样式 | 零 JS 逻辑变更；与 `.composer-kanban-mode-btn.is-active` 风格统一 | 无                     |
| B. inline style            | 用 style 属性动态设置颜色                | 灵活                                                     | 与现有 CSS 方案不一致；覆盖优先级问题 |

**取舍**：采用 **方案 A**，保持与现有 `.is-active` 模式一致。

### 问题 3

| 方案                                                                 | 描述                                                                                                            | 优点          | 风险/缺点                                                   |
|--------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------|-------------|---------------------------------------------------------|
| **A. 阻止 backdrop mousedown 冒泡（推荐）**                                | 在 kanban popover 的面板容器上添加 `onMouseDown={e => e.stopPropagation()}`，但 backdrop 本身使用 `onMouseDown` 代替 `onClick` | 零组件改动，仅改调用方 | 需要修改 `ComposerContextMenuPopover` 支持 `onMouseDown` 关闭模式 |
| **B. 改为手动关闭模式**                                                    | 去掉 backdrop `onClick={onClose}`，改为仅 Escape 键关闭 + 触发按钮 toggle 关闭                                               | 用户交互更自然     | 用户需要记住按 Esc 或点触发按钮关闭                                    |
| **C. 给 ComposerContextMenuPopover 添加 `closeOnBackdropClick` prop** | 新增可选 prop，kanban popover 传 `false`                                                                            | 向后兼容；细粒度控制  | 改组件接口，但改动极小                                             |

**取舍**：采用 **方案 C**，改动最小且意图明确，不破坏其他调用方。

## Capabilities

### New Capabilities

- `opencode-session-deletion`: OpenCode 会话后端 hard delete 能力。

### Modified Capabilities

- `conversation-hard-delete`: 补齐 OpenCode 删除路径。
- `composer-persistent-input-with-filetree`: 看板 trigger icon 选中态视觉反馈、看板 popover 关闭策略修复。

## 验收标准

**问题 1**：

- 用户可在 sidebar 或 Workspace Home 成功删除 OpenCode 会话，无 ENGINE_UNSUPPORTED 报错。
- 删除成功后重启不复活。
- 删除成功响应必须包含 `method` 字段（`"cli"` 或 `"filesystem"`），用于诊断与回归验证。
- 删除失败时 UI 显示具体错误。
- `workspace_id` 无效时返回 `WORKSPACE_NOT_CONNECTED`，且前端给出明确提示。
- Claude/Codex 删除不受影响。

**问题 2**：

- 选中看板后，trigger button 的 icon、文字、边框变为深色（`--text-strong` / `--border-strong`）。
- 取消选中后，trigger button 恢复为默认灰色（`--text-muted` / `--border-subtle`）。
- 视觉效果与 hover 态有区分（选中态持久，hover 态短暂）。

**问题 3**：

- 看板 popover 打开后，点击 Composer 输入框区域不关闭 popover。
- 看板 popover 仍可通过 Escape 键关闭。
- 看板 popover 仍可通过再次点击触发按钮关闭。
- 其他使用 `ComposerContextMenuPopover` 的 popover 不受影响（默认行为保持不变）。

## Impact

- Rust 后端
    - `src-tauri/src/engine/commands.rs`（新增 `opencode_delete_session` command）
    - `src-tauri/src/lib.rs`（注册新 command）
- 前端
    - `src/features/threads/hooks/useThreadActions.ts`（OpenCode 删除分支改造）
    - `src/services/tauri.ts`（新增 `deleteOpenCodeSession` IPC 调用）
    - `src/features/composer/components/Composer.tsx`（看板 trigger 选中态类名）
    - `src/styles/composer.css`（新增 `.is-active` 样式）
    - `src/features/composer/components/ComposerContextMenuPopover.tsx`（新增 `closeOnBackdropClick` prop）
- 规范
    - 修改 `conversation-hard-delete` spec
    - 新增 `opencode-session-deletion` spec
    - 新增 `kanban-trigger-active-state` spec
    - 新增 `kanban-popover-dismiss-behavior` spec
