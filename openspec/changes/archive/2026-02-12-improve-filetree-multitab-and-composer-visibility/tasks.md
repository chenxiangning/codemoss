## 1. 文件多 Tab 状态与行为（P0）

- [x] 1.1 [P0][depends: none] 在文件查看模块定义 `openFileTabs` 与 `activeFileTabId`。输入：文件树点击事件；输出：可追踪的
  Tab 状态；验证：打开第二个文件后首个文件仍在 Tab 列表。
- [x] 1.2 [P0][depends: 1.1] 实现 `openOrActivateTab(file)` 行为。输入：文件节点；输出：已打开文件激活、未打开文件追加；验证：重复点击同一文件不会新增重复
  Tab。
- [x] 1.3 [P0][depends: 1.1] 实现 `closeTab(fileId)` 与活动 Tab 回退规则。输入：待关闭 tabId；输出：Tab 列表更新 +
  新活动项；验证：关闭活动 Tab 后焦点落在相邻 Tab。

## 2. 文件查看区 Tab UI 接入（P0）

- [x] 2.1 [P0][depends: 1.2] 在文件查看区新增标签栏渲染。输入：open tabs 状态；输出：可切换/可关闭标签；验证：点击标签可切换内容，关闭按钮可移除标签。
- [x] 2.2 [P0][depends: 2.1] 保持空态与单文件入口兼容。输入：0 tab 与 1+ tab 场景；输出：空态提示与现有打开入口均可用；验证：无
  tab 时不报错且可继续从文件树打开。

## 3. Composer 常驻可见布局改造（P0）

- [x] 3.1 [P0][depends: none] 调整主页面布局为“文件区可滚动 + Composer 底部常驻”。输入：现有容器结构；输出：Composer
  始终可见；验证：打开文件区后输入框仍在可视区。
- [x] 3.2 [P0][depends: 3.1] 修复小窗口/紧凑模式下遮挡与滚动冲突。输入：窄宽度窗口；输出：不遮挡、不双滚动冲突；验证：手工测试窄窗可输入可发送。

## 4. 回归测试与质量门禁（P0）

- [x] 4.1 [P0][depends: 1.x,2.x] 新增/更新文件区测试覆盖多 Tab 打开、去重、关闭回退。输入：文件列表
  mock；输出：测试用例通过；验证：关键断言覆盖三种行为。
- [x] 4.2 [P0][depends: 3.x] 新增/更新布局与交互测试覆盖“文件查看态下 Composer
  可见可输入”。输入：页面渲染场景；输出：测试用例通过；验证：可找到输入框并可触发发送。
- [x] 4.3 [P0][depends: 4.1,4.2] 执行 `npm run typecheck && npm run lint && npm run test`
  ，并记录全量测试基线噪声。输入：完整改动；输出：typecheck/lint 通过、定向测试通过；验证：无新增 error，且本提案相关测试通过。

## 5. OpenSpec 收口（P0）

- [x] 5.1 [P0][depends: 4.3] 更新 tasks 勾选状态并补充实现说明。输入：实际实现结果；输出：tasks 与实现一致；验证：无“已完成但未勾选”项。
- [x] 5.2 [P0][depends: 5.1] 执行 `openspec validate improve-filetree-multitab-and-composer-visibility --strict`。输入：完整
  artifacts；输出：验证通过；验证：CLI 返回 success。

## 6. 验证记录（2026-02-12）

- [x] `npm run -s typecheck` 通过。
- [x] `npm run -s lint` 通过（仓库既有 warnings 由 13 条降为 11 条，本提案无新增 warning）。
- [x] 定向测试通过：`useGitPanelController.test.tsx`、`ComposerEditorHelpers.test.tsx`、`Messages.test.tsx`。
- [x] `npm run -s test` 全量执行存在仓库基线失败（`useQueuedSend`/`SettingsView`/`Home`）与 Node OOM 噪声，已记录为非本提案新增问题。
