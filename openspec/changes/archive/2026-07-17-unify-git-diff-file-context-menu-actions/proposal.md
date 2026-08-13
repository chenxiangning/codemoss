## Why

Git Diff changed-file rows already share the same renderer, but single-repository mode wires a custom mutation menu while multi-repository mode passes `onShowFileMenu={() => {}}`. The no-op leaks the WebView native context menu and leaves Stage / Unstage / Discard behavior inconsistent across repository topology.

## 目标与边界

- 统一 single-repository flat/tree rows 与 multi-repository grouped rows 的 `Git` context submenu。
- mutation identity 必须保留 `workspaceId + repositoryRoot + section + normalized path + operation`，特别是 `repositoryRoot === ""`。
- 只复用现有 Stage / Unstage / Discard callback、refresh path 与 destructive confirmation dialog。
- 保留 file open、preview、commit inclusion、section collapse、selection 与 polling 的现有行为。

## What Changes

- 新增共享 Git Diff file context-menu item builder，以同一 action matrix 生成菜单：
  - staged row: `Unstage file`
  - unstaged row: `Stage file` + `Discard change`
- 将 multi-repository 的两处 no-op `onShowFileMenu` 替换为显式 repository-scoped callback。
- 将 single-repository menu 收敛为 section-aware behavior，并使用既有 i18n keys，避免中文界面显示硬编码 English。
- 对 diff-only fallback / `mutationDisabled` row 隐藏 mutation menu。
- 增加 single/multi、same-path cross-repository、workspace-root `""`、discard confirmation 与 event-isolation regression tests。

## 非目标

- 不增加 Show File History、Git Blame、Open file 等新 context-menu action。
- 不把 Commit、Stage all、Update、Push、Pull、Fetch 等 repository-level command 放入 file menu。
- 不新增 backend command、Tauri payload、dependency、persistent state 或跨 repository bulk mutation。
- 不修改 inline row action、preview modal、commit composer 或 Git status polling cadence。

## 方案取舍

### 方案 A：共享 pure builder + parent-owned menu host（采用）

`GitDiffPanel` 继续唯一持有 `RendererContextMenu` state 和 discard dialog；focused helper 只构建 typed items，multi-repository adapter 显式转发 repository identity。该方案复用现有 portal、a11y、viewport clamp 与 mutation callback，避免继续扩大 2800+ 行 component 内的重复逻辑。

### 方案 B：每种 repository mode 各自持有 context menu（不采用）

实现局部直接，但会复制 menu state、i18n、discard/refresh policy，并持续制造 single/multi behavior drift。

### 方案 C：使用 native Tauri/OS context menu（不采用）

需要新的 desktop/browser adapter 和 platform parity 验证，且无法复用现有 `RendererContextMenu` submenu 与测试契约，超出当前需求。

## 验收标准

- single-repository flat/tree 与 multi-repository grouped status-backed row 右键均阻止 native menu，并显示同一个 `Git` submenu。
- staged row 仅出现 Unstage；unstaged row 仅出现 Stage 与 danger-tone Discard。
- multi-repository action 精确命中 row owner 的 `repositoryRoot + path`；两个 repository 的同名 path 不串仓。
- `repositoryRoot === ""` 原样保留；diff-only / `mutationDisabled` row 不暴露 mutation。
- Discard 打开现有 confirmation；cancel 为零 mutation，confirm 后 scoped revert 并刷新一次。
- 菜单打开和关闭不触发 file open、commit inclusion 变更、section collapse 或 refresh；保留既有 row selection 语义。
- focused Vitest、lint、typecheck、large-file gate 与 strict OpenSpec validation 通过。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `git-panel-diff-view`: 增加 single/multi changed-file context menu parity、section-aware action matrix、repository scope 与 mutation-disabled behavior requirements。

## Impact

- Frontend components:
  - `src/features/git/components/GitDiffPanel.tsx`
  - `src/features/git/components/GitMultiRepositoryChanges.tsx`
  - focused Git Diff context-menu helper
- Tests:
  - `GitDiffPanel.test.tsx`
  - `GitMultiRepositoryChanges.test.tsx`
- Code-level contract:
  - `dev-guidelines/frontend/multi-repository-git-commit-workspace.md`
- Behavior spec:
  - `openspec/specs/git-panel-diff-view/spec.md` after verify/sync
- Backend/API/dependencies: unchanged。
