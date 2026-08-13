## Why

File History 当前 `.file-history-workbench` 用固定 `clamp(240px, 26%, 360px) minmax(0, 1fr)` 两列网格，commit rail 宽度不可调，且 diff 区域内 previous/source 两栏比例固定 1:1。当用户想给 commit list 更多空间、或给某一对比栏更多空间时，没有任何抓手。右侧 diff 区域的 compare columns 被强制 `minmax(0, 1fr)` + `overflow: hidden`，长行会撑破 CodeMirror cm-scroller 的可视宽度而无法横向滚动，用户只能看到被截断的代码，严重影响阅读。

## 目标与边界

- 下面面板拆成 3 个可拖拽区域：commit rail / previous version column / source version column。
- 在 commit rail 与 diff 之间新增纵向拖拽手柄；previous/source 之间复用同一手柄样式；双击复位到默认宽度。
- diff 区域长行必须可横向滚动：CodeMirror cm-scroller 局部滚动为默认，columns 容器不再以 `overflow: hidden` 截断超宽内容。
- 拖拽行为按 inline-size container 重新计算，与现有 980px / 720px container breakpoints 兼容。
- 沿用 `GitHistoryPanel` 已有的 window-level resize 模式；宽度仅保存在 component ref / CSS custom property，不持久化到 storage。
- Git 面板“在中间区域预览”保留既有双栏/单栏、全文/区域 toolbar controls；当处于双栏 text diff 时，body 复用与 File History 相同的 `WorkspaceReadOnlyDiffCompare` aligned CodeMirror renderer。

## 非目标

- 不修改 backend Git command、`FileHistoryTarget`、path identity、image/binary renderer 或 stale-response contract。
- 不改变 File History 关闭/切换/tab 行为；不引入跨重启的 width persistence。
- 不改 `WorkspaceReadOnlyDiffCompare` 的 parser、column renderer、compare markers 与 scroll-sync 语义；只追加 optional resizable layout。
- 不移除中间区域预览的既有 toolbar controls，不改变 unified、image、binary、PR 与 editable modal preview。
- 不为 splitter 新增独立 hook/module；outer splitter 留在 `FileHistoryView`，shared compare splitter 留在 `WorkspaceReadOnlyDiffCompare`。

## What Changes

- `src/features/git-history/components/FileHistoryView.tsx`：
  - commit rail width 使用 ref + CSS custom property，避免拖拽触发 React render。
  - 在 `<aside class="file-history-commits">` 与 `<main class="file-history-diff">` 之间渲染纵向 splitter；双击复位。
  - 复用 `<WorkspaceReadOnlyDiffCompare resizableColumns>` 渲染 previous/source splitter。
- `src/features/git/components/WorkspaceReadOnlyDiffCompare.tsx`：
  - 承担 shared previous/source splitter，保留 difference navigation、line markers、gutter labels 与 vertical scroll sync。
  - 拖拽以起点快照计算，通过 `requestAnimationFrame` 合并高频 DOM 更新，mouseup 后提交最终 ratio，并在 unmount 时 cleanup。
- `src/features/layout/hooks/useLayoutNodes.tsx`：
  - 中间区域预览继续渲染既有 `GitDiffViewer` toolbar；split text body 改用 `WorkspaceReadOnlyDiffCompare`。
  - unified/image/binary/PR 路径继续使用 `GitDiffViewer` body。
- `src/styles/file-history.css`：
  - 新增 `.file-history-vertical-resizer`；shared compare splitter 样式位于 `diff.css`。
  - 把 `.file-history-diff .editable-diff-compare-columns` 的 `overflow: hidden` 改为 `overflow-x: auto`，保证列本身仍 `minmax(0, 1fr)`，长行由 cm-scroller 内部滚动；列容器允许自身横向 overflow 透出。
  - 保持 narrow container breakpoint（720px）下 stack 行为不受影响。
- `dev-guidelines/frontend/file-history-view.md`：在 §3 Contracts 增加「3 resizable regions」与「diff horizontal scroll」要求；在 §6 Tests Required 增加对应断言。
- `src/styles/file-history-layout.test.ts`：断言 splitter class 与 columns container overflow 不再 hidden。
- `src/features/git-history/components/FileHistoryView.test.tsx`：新增 focused Vitest 覆盖 splitter mousedown→mousemove→mouseup 调整宽度 + 双击复位。

### 技术方案对比

- **选项 A：在现有 owner 内使用 ref + CSS custom property（采用）**。outer splitter 由 `FileHistoryView` 持有；可复用的 compare splitter 由 `WorkspaceReadOnlyDiffCompare` 持有，不新增 hook。
- **选项 B：抽 `useFileHistorySplitLayout` hook 复用 `beginVerticalResize`**。能复用 GitHistoryPanel 的 resize pattern，但本任务只有一个组件两个 splitter，抽出反而增加间接层。

## Capabilities

### Modified Capabilities

- `file-history-view`：workbench 由「不可调两列」改为「3 个可拖拽区域 + diff 区域横向滚动」。
- `git-panel-diff-view`：中间区域 split text preview 保留 toolbar controls，并与 File History 复用 aligned compare body。

## 验收标准

- 拖拽 commit↔diff 手柄时，commit rail 宽度在 [200px, 60% of container] 区间平滑变化，diff 区域随之收放。
- 拖拽 previous↔source 手柄时，两栏比例在 [0.2, 0.8] 区间平滑变化，超出区间时 clamp 到边界。
- 任一手柄双击后，两个区域回到默认宽度/比例（commit rail 默认 300px、previous 50%）。
- 长行（>diff column 宽度）触发 cm-scroller 横向滚动，不撑宽 File History workspace。
- 中间区域 split text preview 的 toolbar controls 保持可用；body 与 File History 使用同一 shared renderer，切换 unified 后回到既有 patch renderer。
- `npm run typecheck` + `npm run lint` + focused Vitest（`FileHistoryView.test.tsx`、`file-history-layout.test.ts`）全部通过。
- `openspec validate enable-file-history-resizable-pane-and-diff-horizontal-scroll --strict --no-interactive` 通过。

## Impact

- Frontend：`FileHistoryView.tsx`、`WorkspaceReadOnlyDiffCompare.tsx`、`GitDiffViewer.tsx`、`useLayoutNodes.tsx` 与关联 styles/loaders。
- Tests：File History、shared compare、center preview 与 CSS loader/layout focused suites。
- Spec：`dev-guidelines/frontend/file-history-view.md` 增加 contracts。
- 无新增 dependency；无 backend 变更；无 i18n 新增键。
