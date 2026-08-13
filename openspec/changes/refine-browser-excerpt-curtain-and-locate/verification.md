# Verification / 边界审核

日期：2026-08-13  
范围：网页摘录幕布 / composer 预览 / 点选 / locate prompt

## 功能边界

| 面 | 结论 | 证据 |
|---|---|---|
| 细线折叠默认标题 | 通过 | SummaryCard / Preview tests：默认无全文，点行才出 |
| 重复点选 | 通过 | `browserSelectionIdentity` + attachment hook tests |
| locate 进 prompt | 通过 | viewModel + `formatBrowserContextPrompt` 含 documentPosition / inList / previous / usageHint |
| 旧数据回推坐标 | 通过 | 无 locate 时仍出 `documentPosition` |
| 隐私 | 通过 | 邻居/路径走 `sanitizeAnnotationText`；不发截图 |
| 选择器吸附 | 脚本层 | rust tests 含 `promoteToContentUnit`；手测依赖重新进入点选 |
| composer 蓝卡语义 | 有意变更 | refresh/remove/expired 仍在；chips 不再是主形态 |
| 整页 snapshot attach | 保留 | 无 selected elements 时走 snapshot 行 |

## 回归

- `npx vitest run src/features/browser-agent src/styles/messages-context-stack.test.ts`：**21 files / 87 tests passed**
- `cargo test --lib browser_agent::toolbar::tests`：**6 passed**（含 selector 脚本）
- 未跑全仓 `npm test` / 全量 `cargo test`（范围外引擎套件）
- working-tree 另有 Dock tab 右键菜单改动，**不纳入本 change / 本 commit**

## 性能

| 路径 | 风险 | 结论 |
|---|---|---|
| 幕布根链 | 摘录 fold 在 MessageRow 子树，无每事件 setState、无数组追加进根 hook | 不踩 Render Perf 红线 |
| 选择器 pointermove | 仅 selector mode 注入；promote 深度 8；无每帧 IPC | 可接受 |
| prompt 体积 | locate 为短文本，无图 | 增量远小于 readableBlocks |
| 去重 | O(n) 线性，n 为选择条数 | 可忽略 |

## 已知缺口

- 选区 crop 未做（视觉门禁）
- 已发出的旧摘录没有 previous/next，除非重选
- 选择器脚本需新会话 / 重新进入点选才加载

## 结论

功能与性能未发现阻断回归。可以提交摘录相关文件。
