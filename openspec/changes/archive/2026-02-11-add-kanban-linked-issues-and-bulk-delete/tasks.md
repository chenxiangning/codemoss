## 1. WorkspaceHome 批量管理能力（P0）

- [x] 1.1 [P0][depends: none] 在 `WorkspaceHome` 增加 browse/manage 双态与选中集合状态。输入：最近会话列表；输出：可切换管理态
  UI；验证：非管理态点击仍进入会话，管理态点击只切换选中。
- [x] 1.2 [P0][depends: 1.1] 增加“全选/取消全选/已选数量”操作栏与按钮禁用态。输入：当前列表与选中集合；输出：批量操作栏状态正确；验证：全选数量与列表长度一致，取消后数量为
  0。
- [x] 1.3 [P0][depends: 1.2] 增加“删除已选”确认流程（含数量提示）与删除中防重入。输入：选中集合；输出：确认弹窗与删除中状态；验证：删除中按钮禁用，取消确认不触发删除。

## 2. App 批量删除接线（P0）

- [x] 2.1 [P0][depends: 1.3] 在 `App.tsx` 向 `WorkspaceHome` 注入批量删除回调。输入：选中 threadId
  列表；输出：批量删除执行入口；验证：回调触发后列表减少。
- [x] 2.2 [P0][depends: 2.1] 复用 `removeThread + clearDraftForThread + removeImagesForThread`
  串行执行删除。输入：workspaceId + threadIds；输出：线程与对应草稿/图片缓存清理；验证：被删线程不可见且缓存已清。

## 3. Composer 顶部 Kanban 关联问题展示（P1）

- [x] 3.1 [P1][depends: none] 在输入区上方固定渲染关联问题条（非折叠时可见），复用 `linkedKanbanPanels`
  。输入：关联面板数组；输出：可见关联条；验证：有数据显示条目，无数据显示空态。
- [x] 3.2 [P1][depends: 3.1] 复用现有选择/跳转行为并保留草稿。输入：点击主按钮/跳转按钮；输出：活动项切换与 Kanban
  跳转；验证：跳转后输入草稿不丢失。

## 4. i18n 与样式完善（P1）

- [x] 4.1 [P1][depends: 1.1,3.1] 在 `zh.ts/en.ts` 增加批量管理与确认文案键。输入：新增 UI 文案；输出：双语文案可解析；验证：中英文环境均无缺失键。
- [x] 4.2 [P1][depends: 1.2] 在 `workspace-home.css` 增加管理态、复选标记、操作栏样式，适配桌面/窄屏。输入：管理态
  class；输出：样式正确；验证：窄屏不遮挡主按钮。

## 5. 测试与验收（P0）

- [x] 5.1 [P0][depends: 1.x,2.x] 新增/更新 `WorkspaceHome` 组件测试覆盖多选、全选、批量删除确认路径。输入：测试用
  recentThreads；输出：通过用例；验证：测试断言覆盖关键路径。
- [x] 5.2 [P0][depends: 3.x] 新增/更新 Composer 相关测试覆盖“顶部关联条可见与交互不回归”。输入：linkedKanbanPanels
  mock；输出：通过用例；验证：以现有回归集 + 手工验证完成（测试环境 ESM 解析限制下未新增稳定单测文件）。
- [x] 5.3 [P0][depends: 5.1,5.2] 执行 `lint + typecheck + targeted tests` 并修复问题。输入：代码变更；输出：质量门通过；验证：命令
  exit code 为 0。

## 6. OpenSpec 收口（P0）

- [x] 6.1 [P0][depends: 5.3] 将已完成任务勾选并补充实施说明。输入：实际改动结果；输出：tasks.md 已更新；验证：任务状态与实现一致。
- [x] 6.2 [P0][depends: 6.1] 执行 `openspec validate add-kanban-linked-issues-and-bulk-delete --strict`。输入：完整
  artifacts；输出：验证通过；验证：CLI 返回 success。
