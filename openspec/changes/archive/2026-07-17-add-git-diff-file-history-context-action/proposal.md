## Why

Git Diff changed-file 右键菜单已经统一 Stage、Unstage 与 Discard，但现有 File History 入口只存在于 FileTree。用户在 review staged/unstaged changes 时必须先回到文件树重新定位同一文件，且 multi-repository 下容易丢失 repository scope。

## 目标与边界

- 在 single-repository flat/tree 与 multi-repository grouped changed-file row 的同一个 `Git` submenu 中增加 `显示文件历史`。
- 复用现有 `FileHistoryTarget`、`handleOpenFileHistory` 与独立 File History workspace，不新增 Git history command 或 renderer。
- History 始终绑定右键命中的单个文件；selection 只继续影响 Stage/Unstage/Discard bulk action。
- 保留 `repositoryRoot === ""` 的 explicit workspace-root identity，并为 nested repository 生成 repository-relative `path` 与 workspace-relative `displayPath`。
- 缺少 host callback、workspace identity 或可验证 repository scope 时不展示 dead entry。

## 非目标

- 不给 File History 增加 mutation、branch filter、Blame 或多文件 history。
- 不改变 Stage/Unstage/Discard 的 selection、confirmation 与 refresh contract。
- 不新增 backend、Tauri IPC、daemon payload、依赖或样式系统。
- 不扩展 detached explorer 或 WebView native context menu。

## What Changes

- 扩展 shared Git Diff file context-menu builder，使 read-only History action 与 mutation actions 共用一个 `Git` submenu。
- 将 AppShell 已有 `onOpenFileHistory(FileHistoryTarget)` capability 透传给 `GitDiffPanel`。
- 为 single/multi repository row 构造 exact File History target，并使 stale menu 随 workspace、repository topology 或 callback 变化关闭。
- mutation-disabled/diff-only row 仍禁止 Stage/Unstage/Discard；若 history target 合法，则只展示 `显示文件历史`。
- 增加 helper、panel、layout wiring 与 repository identity regression tests。

## 方案比较与取舍

1. **推荐：扩展现有 shared menu builder + 透传 existing callback**。最小改动即可复用 File History surface，并让 single/multi row 使用同一 action ordering 与 scope mapping。
2. **在 `GitDiffPanel` 内各自追加 inline menu item**。初始代码少，但 single/multi 会复制 ordering、availability 与 stale guard，后续再次漂移，因此拒绝。
3. **从 row dispatch global event 打开 File History**。会绕过 typed `FileHistoryTarget` 与 layout callback contract，扩大全局状态边界，因此拒绝。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `git-panel-diff-view`: changed-file `Git` submenu 增加 repository-scoped read-only File History action，并明确与 bulk mutation selection 隔离。
- `file-history-view`: File History host entry 从 FileTree 扩展到 Git Diff single/multi repository changed-file rows。

## 验收标准

- single root/nested repository 的 staged/unstaged flat/tree row 均可从 `Git -> 显示文件历史` 打开 exact target。
- multi repository 相同 relative path 只打开右键所属 repository；`repositoryRoot === ""` 不发生 truthy fallback。
- 多选时 History 只打开 clicked row，Stage/Discard 继续保持原 bulk behavior。
- mutation-disabled row 无 mutation action，但合法时仍可查看历史；callback/scope 缺失时无 dead item。
- focused Vitest、lint、typecheck、strict OpenSpec validation 与 `git diff --check` 通过。

## Impact

- Frontend: `GitDiffPanelTypes.ts`、`GitDiffPanel.tsx`、`GitDiffPanelFileContextMenu.ts`、`useLayoutNodes.tsx` 及 focused tests。
- Behavior specs: `git-panel-diff-view`、`file-history-view`。
- Trellis executable contract: `dev-guidelines/frontend/multi-repository-git-commit-workspace.md` 与 `dev-guidelines/frontend/file-history-view.md`。
- API/dependencies: 无新增或 breaking change；仅增加 optional React callback。
