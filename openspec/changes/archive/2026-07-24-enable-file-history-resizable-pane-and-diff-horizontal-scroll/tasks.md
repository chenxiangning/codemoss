## 1. OpenSpec Artifacts

- [x] 1.1 Author proposal + design + spec delta + tasks for resizable file history panes and diff horizontal scroll; output: `openspec/changes/enable-file-history-resizable-pane-and-diff-horizontal-scroll`; validation: `openspec validate enable-file-history-resizable-pane-and-diff-horizontal-scroll --strict --no-interactive`. [P0][I][O: change dir][V: openspec validate]

## 2. FileHistoryView Splitter

- [x] 2.1 Add `commitRailWidth` / `previousColumnRatio` state + default constants (`COMMIT_RAIL_DEFAULT_PX=300`, `PREVIOUS_COLUMN_DEFAULT_RATIO=0.5`). [P0][I][O: FileHistoryView.tsx][V: typecheck]
- [x] 2.2 Render `<div className="file-history-vertical-resizer">` between commit rail and diff; mousedown→window mousemove/mouseup 调 commit rail width（clamp 到 [200, 60% of container]）；double-click reset. [P0][I][O: FileHistoryView.tsx][V: focused test]
- [x] 2.3 Wrap `<WorkspaceReadOnlyDiffCompare>` 在 `gridTemplateColumns: minmax(0, ${ratio}fr) ${SPLITTER}px minmax(0, 1fr)` 容器中，渲染第二个 splitter；double-click reset. [P0][I][O: FileHistoryView.tsx][V: focused test]
- [x] 2.4 当 commit rail width 或 previous column ratio 变化时，sync 到 `data-resizing="true"` on body 以便 css 显示 grabbing 状态。 [P1][I][O: FileHistoryView.tsx][V: manual]

## 3. CSS

- [x] 3.1 新增 `.file-history-vertical-resizer` 与 `.file-history-compare-resizer` 样式（与 `git-history-vertical-resizer` 视觉一致），包括 hover / active 边框颜色 token。 [P0][I][O: file-history.css][V: layout test]
- [x] 3.2 把 `.file-history-diff .editable-diff-compare-columns` 的 `overflow: hidden` 改为 `overflow-x: auto`，并确保两个 compare column 仍 `min-width: 0` + `minmax(0, 1fr)`。 [P0][I][O: file-history.css][V: layout test]
- [x] 3.3 720px breakpoint 下保留 stack 行为；splitter 在 stack 时隐藏。 [P0][I][O: file-history.css][V: layout test]

## 4. Spec Sync

- [x] 4.1 在 `dev-guidelines/frontend/file-history-view.md` §3 Contracts 增加「3 resizable regions」与「diff horizontal scroll」要求行；§6 Tests Required 增加 layout 与 resize 断言。 [P0][I][O: file-history-view.md][V: openspec validate]

## 5. Tests

- [x] 5.1 `src/features/git-history/components/FileHistoryView.test.tsx`：增加 focused 用例验证 (a) splitter 渲染存在；(b) `mouseDown` on commit splitter + `mousemove` on window → commit rail width 变化；(c) double-click 复位；(d) 第二个 splitter 调 ratio。 [P0][V: vitest]
- [x] 5.2 `src/styles/file-history-layout.test.ts`：增加断言 `.file-history-vertical-resizer` / `.file-history-compare-resizer` class 存在；columns container 不再 hidden。 [P0][V: vitest]

## 6. Gates

- [x] 6.1 `npm run typecheck` 通过。 [P0][V: typecheck]
- [x] 6.2 `npm run lint` 通过。 [P0][V: lint]
- [x] 6.3 focused Vitest (`FileHistoryView.test.tsx` + `file-history-layout.test.ts`) 通过。 [P0][V: vitest]
- [x] 6.4 `openspec validate enable-file-history-resizable-pane-and-diff-horizontal-scroll --strict --no-interactive` 通过。 [P0][V: openspec validate]

## 7. Review Fixes

- [x] 7.1 修复 outer/inner splitter 的累计 delta 算法：使用 drag-start snapshot；高频更新走 ref + `requestAnimationFrame`，mouseup 提交最终值；补连续 `mousemove` 回归测试。 [P0][V: focused test]
- [x] 7.2 修复 previous/source ratio 的真实比例计算、≤720px inline-style override、两个 splitter narrow 隐藏、unmount/target-change cleanup 与 `targetKey` 分隔符回退。 [P0][V: focused test + layout test]
- [x] 7.3 `FileHistoryView` 恢复复用 `WorkspaceReadOnlyDiffCompare`，保留 difference navigation、gutter labels、semantic tone 与 scroll sync。 [P0][V: focused test]

## 8. Center Preview Renderer Convergence

- [x] 8.1 扩展 `WorkspaceReadOnlyDiffCompare` 支持 optional resizable columns，并保证默认 50/50、clamp [0.2, 0.8]、双击复位和 cleanup。 [P0][V: component test]
- [x] 8.2 Git 中间区域 preview 保留既有 toolbar controls；split text body 使用 shared aligned compare；unified/image/binary/PR 保持原 renderer。 [P0][V: layout hook/component test]
- [x] 8.3 更新 `dev-guidelines/frontend/file-history-view.md` 与相关 CSS contract，记录 shared renderer 和 smooth drag 约束。 [P1][V: contract test]

## 9. Review Closure Gates

- [x] 9.1 修复或校准 `GitDiffPanel.test.tsx` repository-scoped discard button数量断言，确认不是功能回退。 [P1][V: focused test]
- [x] 9.2 运行 affected Vitest、`npm run lint`、`npm run typecheck`、`npm run check:large-files`。 [P0][V: gates]
- [x] 9.3 运行 strict OpenSpec validation，并核对 File History 拖拽与中间区域 toolbar/body convergence。 [P0][V: openspec validate + focused test]
