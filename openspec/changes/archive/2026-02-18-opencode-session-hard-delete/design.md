# Design: UX 交互调整 — OpenCode 删除 & 看板交互修复

## Context

### 问题 1: OpenCode 删除

CodeMoss 集成三个 AI 引擎，各引擎的会话删除实现差异如下：

| 引擎       | 删除方式                                          | 后端入口                                                 | 当前状态 |
|----------|-----------------------------------------------|------------------------------------------------------|------|
| Claude   | Tauri Command `delete_claude_session` → 文件硬删除 | `src-tauri/src/engine/claude_history.rs`             | 可用   |
| Codex    | LSP 协议 `thread/archive` → 归档                  | `src-tauri/src/shared/codex_core.rs`                 | 可用   |
| OpenCode | 无 → `throw Error("ENGINE_UNSUPPORTED")`       | `src/features/threads/hooks/useThreadActions.ts:991` | 不可用  |

前端调用链：

```
UI Delete Button
  → useThreads.deleteThread()
    → useThreadActions.deleteThreadForWorkspace()
      → if "claude:" → archiveClaudeThread()         ✅
      → if "opencode:" → throw Error                  ❌ (当前)
      → else (codex) → archiveThread()                ✅
```

OpenCode 引擎通过 CLI subprocess (`opencode run --format json`) 交互，无 LSP 协议可用。但后端已有多个 OpenCode CLI 子命令的封装：

- `opencode session list` → `opencode_session_list` command
- `opencode export <session_id>` → `opencode_export_session` command
- `opencode run --session <id> --share` → `opencode_share_session` command

这些已有模式为新增删除命令提供了成熟的代码参考。

### 问题 2: 看板 Trigger 选中态

Composer 底部 toolbar 有一个"关联项目看板"触发按钮，结构如下：

```
┌────────────────────────────────────────────────────┐
│  Composer Input                                    │
├────────────────────────────────────────────────────┤
│  [toolbar-left pills...]         [📋 微调 ▾] [↗] │  ← trigger button
└────────────────────────────────────────────────────┘
```

**当前实现**（`Composer.tsx:1337-1346`）：

```tsx
<button
  className="composer-kanban-trigger"  // ← 始终同一个类名，无选中态
  onClick={() => setKanbanPopoverOpen(prev => !prev)}
>
  <ClipboardList size={10} />
  <span>{selectedLinkedPanel?.name ?? linkedKanbanPanels[0].name}</span>
  <ChevronDown size={10} />
</button>
```

**CSS 现状**（`composer.css:1644-1663`）：

- `.composer-kanban-trigger` → `color: var(--text-muted)`, `border: 1px solid var(--border-subtle)`
- `.composer-kanban-trigger:hover` → `color: var(--text-strong)`, `border-color: var(--border-strong)`
- 无 `.is-active` 选中态

选中判断依据：`selectedLinkedPanel`（line 830）= `linkedKanbanPanels.find(p => p.id === selectedLinkedKanbanPanelId)`，当非
null 时表示已选中。

### 问题 3: 看板 Popover 外部点击导致关闭

**`ComposerContextMenuPopover` 架构**（`src/features/composer/components/ComposerContextMenuPopover.tsx`）：

```tsx
// 第 153-161 行：Portal 渲染结构
return createPortal(
  <>
    <div className="composer-context-backdrop" onClick={onClose} aria-hidden="true" />
    <div ref={panelRef} className={mergedClassName} style={panelStyle} {...restPanelProps}>
      {children}
    </div>
  </>,
  document.body,
);
```

**CSS 层级**（`composer.css`）：

```css
.composer-context-backdrop {
  position: fixed;
  inset: 0;           /* 全屏覆盖 */
  z-index: 1190;      /* 面板下层 */
  background: transparent;
}

.composer-context-menu-panel--portal {
  position: fixed;
  z-index: 1200;      /* 面板上层，视觉可见 */
}
```

**问题机制**：

1. Backdrop 以 `position: fixed; inset: 0` 覆盖整个视口，包括 Composer 主输入区域
2. 用户点击 Composer 输入框时，点击事件命中 backdrop（而非穿透到输入框）
3. `onClick={onClose}` 立即关闭 popover
4. 输入框未能获得焦点，用户操作中断

**当前组件接口**：

```typescript
type ComposerContextMenuPopoverProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  panelClassName?: string;
  panelProps?: HTMLAttributes<HTMLDivElement>;
  children: ReactNode;
};
// 无 closeOnBackdropClick 控制 prop
```

## Goals

1. 为 OpenCode 实现后端 hard delete 能力，消除 ENGINE_UNSUPPORTED 错误。
2. 复用已有的 `build_opencode_command` 基础设施，保持代码风格一致。
3. 删除语义与 `conversation-hard-delete` spec 对齐：后端确认成功才算删除成功。
4. 看板 trigger button 选中时提供深色视觉反馈，取消选中时恢复灰色。
5. 看板 popover 打开时，点击外部区域（含 Composer 输入框）不意外关闭 popover。

## Non-Goals

- 不为三个引擎抽象统一的删除 RPC 接口。
- 不处理正在活跃交互中的会话删除（需先终止）。
- 不引入批量删除 OpenCode 会话的能力（逐条删除即可）。
- 不重新设计看板 trigger button 的整体布局或交互模式。

## Decision #1: 删除策略 — CLI 子命令 vs 文件系统直删

### 选项

| 方案                                  | 描述                                           | 优点                       | 缺点                     |
|-------------------------------------|----------------------------------------------|--------------------------|------------------------|
| **A. 尝试 `opencode session delete`** | 优先调用 CLI 子命令，若不支持则回退                         | 与 CLI 生态对齐；未来 CLI 支持后零改动 | CLI 可能不支持该子命令          |
| **B. 文件系统直删**                       | 定位 `$OPENCODE_HOME/sessions/<id>` 直接删除       | 可控性强，不依赖 CLI 版本          | 需了解存储路径格式；CLI 升级可能变更路径 |
| **C. 混合策略（推荐）**                     | 优先尝试 CLI `session delete`，若返回非零退出码则回退到文件系统删除 | 兼顾 CLI 生态兼容与鲁棒性          | 实现略复杂                  |

### Selection: 方案 C — 混合策略

### Rationale

- OpenCode CLI 可能已经或将来支持 `session delete` 子命令。优先尝试 CLI 路径可保持生态对齐。
- 若 CLI 不支持，回退到文件系统删除作为保底策略。
- 文件系统路径可参考 `opencode export` 输出中的文件路径格式推断。

### Implementation

```rust
#[tauri::command]
pub async fn opencode_delete_session(
    workspace_id: String,
    session_id: String,
    state: State<'_, AppState>,
) -> Result<Value, String> {
    let workspace_path = {
        let workspaces = state.workspaces.lock().await;
        workspaces
            .get(&workspace_id)
            .map(|w| PathBuf::from(&w.path))
            .ok_or_else(|| "[WORKSPACE_NOT_CONNECTED] Workspace not found".to_string())?
    };
    let manager = &state.engine_manager;
    let config = manager.get_engine_config(EngineType::OpenCode).await;

    // 策略 1：尝试 CLI session delete
    let mut cmd = build_opencode_command(config.as_ref());
    cmd.current_dir(&workspace_path);
    cmd.arg("session");
    cmd.arg("delete");
    cmd.arg(&session_id);

    match cmd.output().await {
        Ok(output) if output.status.success() => {
            return Ok(json!({ "deleted": true, "method": "cli" }));
        }
        _ => {
            log::info!("opencode session delete CLI not available, trying file deletion");
        }
    }

    // 策略 2：回退到文件系统删除
    delete_opencode_session_files(&workspace_path, &session_id, config.as_ref())?;

    Ok(json!({ "deleted": true, "method": "filesystem" }))
}
```

## Decision #2: 前端集成路径

### Selection: 修改 `deleteThreadForWorkspace` + 新增 IPC 调用

### Rationale

遵循现有的 `archiveClaudeThread` / `archiveThread` 分支模式，在 OpenCode 分支中调用新的 IPC 函数。

### Implementation

**tauri.ts**（新增 IPC 调用）：

```typescript
export async function deleteOpenCodeSession(
  workspaceId: string,
  sessionId: string,
) {
  return invoke<any>("opencode_delete_session", { workspaceId, sessionId });
}
```

**useThreadActions.ts**（修改 OpenCode 分支）：

```typescript
if (threadId.startsWith("opencode:")) {
  const sessionId = threadId.replace("opencode:", "");
  await deleteOpenCodeSession(workspaceId, sessionId);
  return;
}
```

## Decision #3: 错误映射

### Selection: 复用现有 `ThreadDeleteErrorCode` 体系

| 后端错误场景              | 映射错误码                     | 用户可见提示         |
|---------------------|---------------------------|----------------|
| Workspace not found | `WORKSPACE_NOT_CONNECTED` | "工作区未连接"       |
| Session ID 无效/不存在   | `SESSION_NOT_FOUND`       | "会话不存在"        |
| 文件删除权限不足/IO 错误      | `IO_ERROR`                | "删除失败，请检查文件权限" |
| CLI 与文件系统均失败        | `UNKNOWN`                 | "未知错误"         |

### Rationale

`conversation-hard-delete` spec 已定义标准错误码集合，直接复用可保持三引擎一致性。前端 `mapDeleteErrorCode` 已支持这些错误码的匹配。

## Decision #4: 看板 Trigger 选中态视觉方案

### Selection: CSS `.is-active` 类 + 动态 className

### Rationale

项目中已有大量 `.is-active` 模式（如 `.composer-kanban-mode-btn.is-active`、`.composer-kanban-popover-item.is-active`
），复用此约定保持一致性。

### Implementation

**Composer.tsx**（修改 trigger button className）：

```tsx
<button
  className={`composer-kanban-trigger${selectedLinkedPanel ? " is-active" : ""}`}
  onClick={() => setKanbanPopoverOpen(prev => !prev)}
>
```

**composer.css**（新增选中态样式，紧跟 `:hover` 之后）：

```css
.composer-kanban-trigger.is-active {
  border-color: var(--border-strong);
  color: var(--text-strong);
}
```

**视觉效果对比**：
| 状态 | border | color (text+icon) |
|------|--------|-------------------|
| 默认 | `--border-subtle` | `--text-muted` |
| Hover | `--border-strong` | `--text-strong` |
| 选中 | `--border-strong` | `--text-strong` |
| 选中+Hover | `--border-strong` | `--text-strong` |

选中态与 hover 态视觉一致但语义不同：选中态持久存在，hover 态随鼠标离开消失。

## Decision #5: 看板 Popover 关闭策略

### Selection: 给 `ComposerContextMenuPopover` 新增 `closeOnBackdropClick` prop（默认 `true`）

### Rationale

- 改动极小（1 个 prop + 1 行条件判断），不破坏现有调用方
- 语义明确：`closeOnBackdropClick={false}` 清晰表达"不通过外部点击关闭"的意图
- 其他所有使用 `ComposerContextMenuPopover` 的场景默认行为不变

### Implementation

**`ComposerContextMenuPopover.tsx`**（修改 props 类型 + backdrop 逻辑）：

```typescript
type ComposerContextMenuPopoverProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  panelClassName?: string;
  panelProps?: HTMLAttributes<HTMLDivElement>;
  children: ReactNode;
  closeOnBackdropClick?: boolean;  // 新增，默认 true
};
```

```tsx
// 修改 backdrop 渲染（第 155 行）
<div
  className="composer-context-backdrop"
  onClick={closeOnBackdropClick !== false ? onClose : undefined}
  aria-hidden="true"
/>
```

**`Composer.tsx`**（kanban popover 传入 `closeOnBackdropClick={false}`）：

```tsx
<ComposerContextMenuPopover
  open={kanbanPopoverOpen}
  anchorRef={kanbanPopoverAnchorRef}
  onClose={() => setKanbanPopoverOpen(false)}
  panelClassName="composer-kanban-popover"
  closeOnBackdropClick={false}  // 新增
>
```

**关闭路径对比**：

| 关闭方式                                | 修改前  | 修改后（kanban） |
|-------------------------------------|------|-------------|
| 点击 popover 外部区域                     | ✅ 关闭 | ❌ 不关闭       |
| 按 Escape 键                          | ✅ 关闭 | ✅ 关闭        |
| 点击触发按钮（toggle）                      | ✅ 关闭 | ✅ 关闭        |
| 其他 `ComposerContextMenuPopover` 调用方 | ✅ 关闭 | ✅ 关闭（不受影响）  |

## Risks / Trade-offs

| 风险                                         | 概率 | 影响 | 缓解措施                                                   |
|--------------------------------------------|----|----|--------------------------------------------------------|
| OpenCode CLI 无 `session delete` 子命令        | 高  | 低  | 混合策略自动回退到文件系统删除                                        |
| OpenCode 会话存储路径在不同版本间变化                    | 中  | 中  | 文件路径探测逻辑增加多候选路径；日志记录实际路径                               |
| 删除活跃会话导致 CLI 进程异常                          | 低  | 高  | 前端在删除前检查会话是否活跃，活跃会话禁止删除或先发送 interrupt                  |
| 并发删除同一会话                                   | 低  | 低  | Tauri Command 层面的 Mutex 保护                             |
| `closeOnBackdropClick={false}` 时用户无法点击外部关闭 | 低  | 低  | Escape 键和触发按钮 toggle 仍可关闭；符合用户预期（看板 popover 不应因偶然点击关闭） |

## Migration Plan

### Phase 1: 后端能力（Rust）

1. 在 `commands.rs` 中新增 `opencode_delete_session` Tauri Command。
2. 实现混合删除策略（CLI 优先 + 文件系统回退）。
3. 在 `lib.rs` 中注册新 command。
4. 编写单元测试验证删除逻辑。

### Phase 2: 前端集成（TypeScript）

1. `tauri.ts` 新增 `deleteOpenCodeSession` IPC 调用。
2. `useThreadActions.ts` 修改 OpenCode 分支。
3. 验证错误码映射与 UI 提示。

### Phase 3: 验证

1. 手动创建 OpenCode 会话 → 验证可删除 → 验证重启不复活。
2. 验证 Claude/Codex 删除回归安全。
3. 验证删除不存在的会话返回 SESSION_NOT_FOUND。

### Rollback

若 Phase 1 出现问题，可将 OpenCode 分支改回 throw Error（恢复现状）。前端修改为单文件单分支改动，回滚风险极低。

## Open Questions

1. **OpenCode 会话存储的确切磁盘路径格式是什么？** 需在实现阶段通过 `opencode session list` 结合文件系统探测确认。候选路径：
    - `$OPENCODE_HOME/sessions/<session_id>/`
    - `<workspace>/.opencode/sessions/<session_id>/`
    - `$XDG_DATA_HOME/opencode/sessions/<session_id>/`
2. **OpenCode CLI 是否已支持 `session delete` 子命令？** 实现时需先验证 `opencode session delete --help` 的输出。
