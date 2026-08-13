# Tasks: 修复延迟加载 CSS 的入口漏接与 Git Diff 弹窗滚动合同

## 1. Composer 协作入口自己拉 multi-agent.css

- [x] 完成（`ComposerToggle` 调 `loadSubagentStyles`；portal/modal 等 `stylesReady`）
- 输入：`src/features/multi-agent/components/ComposerToggle.tsx`
- 动作：复用既有 `useFeatureStylesReady(loadSubagentStyles)`，不改 bootstrap
- 输出：未开 Inspector 时弹层不再裸文本
- 验证：`ComposerToggle.styles.test.ts`
- 优先级：P0

## 2. Diff loader 只拉 nav + review shell

- [x] 完成（`loadDiffStyles` 增加两片；checkpoint 整包退出 Git 路径）
- 输入：`src/styles/featureStyleLoaders.ts`
- 动作：新增 `editable-diff-compare-nav.css`、`editable-diff-review-shell.css`；checkpoint CSS `@import` 并收口 compare 规则
- 输出：Git 弹窗有导航壳与 `is-toolbar-only` 隐藏，无 checkpoint 布局泄漏
- 验证：`featureStyleLoaders.test.ts`
- 优先级：P0

## 3. 弹窗双滚动层合同

- [x] 完成（viewer 定高；单栏 `.diff-viewer`；双栏 `.cm-scroller`；列 `overflow: hidden`）
- 输入：`src/styles/git-diff-modal.css`
- 动作：删除拥抱 virtualizer 的 `:not(.is-maximized)` 例外
- 输出：单栏可滚 + dock 可见；双栏 CM 可滚
- 验证：`git-diff-modal-layout.test.ts`；用户手测通过
- 优先级：P0

## 4. 1/1 差异锚点再跳

- [x] 完成（`navigationEpoch` 传入 `CompareEditorColumn`）
- 输入：File compare / editable compare / read-only compare
- 动作：点击上一处/下一处递增 epoch
- 输出：1/1 仍 scroll + flash
- 验证：`WorkspaceFileComparePanel.compare-editor.test.tsx`
- 优先级：P0

## 5. 回归与收口

- [x] 完成（focused vitest 绿；用户确认双栏/单栏都解决）
- 验证：`featureStyleLoaders` + modal layout + compare 相关测试
- 优先级：P1
