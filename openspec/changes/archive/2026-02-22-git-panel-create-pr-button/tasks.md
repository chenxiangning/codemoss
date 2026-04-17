## 1. Backend PR Workflow Commands (P0)

- [x] 1.1 新增 `get_git_pr_workflow_defaults` 与 `create_git_pr_workflow` tauri command，并补齐
  request/result/stage/defaults 类型定义。
- [x] 1.2 落地 token 隔离执行器（默认 `env -u GH_TOKEN -u GITHUB_TOKEN`），统一 git/gh 命令执行入口。
- [x] 1.3 落地 push 阶段 HTTP2 失败的 HTTP/1.1 单次 fallback 重试。
- [x] 1.4 落地 existing PR 检测与短路复用（按 head owner/head branch 查询并复用）。
- [x] 1.5 落地 precheck：`gh` 可用性、auth 状态、upstream 范围门禁（`upstream/<base>...HEAD`）。

## 2. Frontend Entry, Dialog and Workflow UX (P0)

- [x] 2.1 在 Git 顶栏新增 `PR` 入口，并保持现有操作组顺序稳定。
- [x] 2.2 在 `GitHistoryPanel` 内集成 Create PR 弹窗（预填参数 + 标题正文编辑 + 可选评论）。
- [x] 2.3 接入阶段进度展示（`precheck/push/create/comment`）与状态映射（含 `skipped`）。
- [x] 2.4 接入结果态动作：打开 PR、复制链接、复制重试命令、失败提示。
- [x] 2.5 将 compare 参数区重构为单排 compare bar（base repo/base/head repo/compare）。
- [x] 2.6 compare 字段升级为可搜索下拉弹层（自定义 inline picker），替代原生 datalist。

## 3. UI Polish and Readability Iteration (P1)

- [x] 3.1 弹窗整体宽度扩展，缓解长仓库名/分支名拥挤与遮挡。
- [x] 3.2 compare 参数条进行多轮视觉调优：统一高度、对齐、间距、焦点态与层级。
- [x] 3.3 下拉面板宽度与容器对齐，修复横向滚动与溢出展示问题。
- [x] 3.4 选项/当前值增加完整值可见策略（title/tooltip），兼顾整洁与可追溯。
- [x] 3.5 执行进度区优化为 2x2 信息布局，降低表单纵向拉伸。

## 4. I18n, Types and Tests (P0)

- [x] 4.1 补齐 zh/en 文案键（按钮、compare 字段、阶段状态、结果动作、错误提示）。
- [x] 4.2 更新前端类型与 tauri service API，确保 defaults/workflow result 类型闭环。
- [x] 4.3 更新 `GitHistoryPanel.test.tsx`，覆盖入口可见性、弹窗提交流、阶段/结果态关键路径。
- [x] 4.4 补后端 workflow 相关测试（token 隔离、fallback、existing PR、结果语义）。

## 5. Verification Record (P0)

- [x] 5.1 `npm run typecheck` 通过。
- [x] 5.2 `npx vitest run src/features/git-history/components/GitHistoryPanel.test.tsx` 通过。
- [x] 5.3 `cargo test --manifest-path src-tauri/Cargo.toml git::tests` 通过（workflow 相关测试覆盖）。
