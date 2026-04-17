## 1. 视觉规范基线与样式令牌（P0）

- [x] 1.1 盘点 GitDiffPanel 与 GitHistoryWorktreePanel 的树行项差异（输入：现有 TSX + CSS；输出：差异清单与统一映射表；验证：映射表覆盖行高/缩进/图标/hover/selected/badge/分组容器）
- [x] 1.2 在样式层定义共享文件树视觉 token（输入：`diff.css` 与 `git-history.css`；输出：统一 token 与语义 class 约定；验证：无硬编码魔法数字散落在关键选择器）
- [x] 1.3 对齐目标面板的状态色与徽标规范（输入：现有状态样式；输出：hover/selected/正负计数徽标一致；验证：UI 快照对比符合统一规范）

## 2. 展示层收敛改造（P0）

- [x] 2.1 在 `GitDiffPanel.tsx` 挂载统一语义 class（输入：现有渲染结构；输出：行项/分组/徽标具备统一 class contract；验证：组件断言关键 class 存在）
- [x] 2.2 在 `GitHistoryWorktreePanel.tsx` 挂载统一语义 class（输入：现有渲染结构；输出：行项/分组/徽标与 GitDiffPanel 对齐；验证：组件断言关键 class 存在）
- [x] 2.3 在 `GitHistoryPanel.tsx` 对齐文件树相关容器与标题栏视觉语义（输入：现有面板结构；输出：与统一 token/class contract 对齐；验证：不引入新的业务状态分支）
- [x] 2.4 仅做展示壳层微调，不改事件语义（输入：onClick/onContextMenu/状态分支；输出：逻辑零侵入；验证：行为测试与事件触发路径不变）

## 3. 行为零回退验证（P0）

- [x] 3.1 回归 flat/tree 切换与节点展开行为（输入：两面板树视图；输出：交互语义保持一致；验证命令：`pnpm vitest run src/features/git/components/GitDiffPanel.test.tsx src/features/git-history/components/GitHistoryPanel.test.tsx`）
- [x] 3.2 回归 staged/unstaged 分组与计数展示逻辑（输入：分组渲染；输出：分组规则不变；验证命令：`pnpm vitest run src/features/git/components/GitDiffPanel.test.tsx src/features/git-history/components/GitHistoryPanel.test.tsx`，并在用例中断言分组成员与计数未变化）
- [x] 3.3 回归提交与上下文菜单主链路（输入：提交按钮、右键菜单动作；输出：动作语义与结果不变；验证命令：`pnpm vitest run src/features/git-history/components/GitHistoryPanel.test.tsx` + 手动冒烟一次）
- [x] 3.4 类型层回归守卫（输入：前端类型系统；输出：无隐性断链；验证命令：`pnpm tsc --noEmit`）

## 4. 文档与验收闭环（P1）

- [x] 4.1 更新 `specs/file-tree-visual-consistency/spec.md` 的验收场景与术语（输入：proposal/design；输出：可执行验收契约；验证：需求与实现边界一致）
- [x] 4.2 补充最小视觉回归说明（输入：快照/截图对比策略；输出：可追溯审阅记录；验证：变更说明明确“仅样式变化”）
- [x] 4.3 完成 OpenSpec 自检（输入：change artifacts；输出：proposal/design/tasks/spec 一致；验证：无边界冲突、无后端改动条目）
