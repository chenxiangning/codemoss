## Why

当前在 CodeMoss 内发起 Pull Request 仍存在跨上下文成本：用户需要在 Git 面板与终端之间来回切换，手动完成
`push / gh pr create / comment`，并自行处理 token、网络协议与重复 PR 等失败路径。随着 Git 面板已成为高频操作入口，PR
提交流程必须在同一界面内闭环，且具备稳定、可恢复、可观测的执行语义。

## 目标与边界

- 目标：在 Git 顶栏提供 `PR` 入口，在客户端内完成参数确认、预检、推送、创建 PR、可选评论。
- 目标：将 runbook 中已验证的稳定性策略产品化（token 环境隔离、HTTP/1.1 fallback、范围门禁、existing PR 复用）。
- 目标：提供阶段级进度反馈与失败后可操作结果（重试命令、下一步提示、可打开链接）。
- 边界：首版仅面向 GitHub（`gh` + `origin/upstream`），不扩展到 GitLab/Gitee。

## 非目标

- 不实现自动 merge、自动 reviewer 分配、自动 label 策略。
- 不改造 Git 面板整体信息架构，仅在现有 toolbar 与弹窗体系内扩展。
- 不覆盖所有企业代理/网络拓扑，仅内置已验证的通用兜底策略。

## What Changes

- 顶栏入口
    - 在 Git toolbar 新增 `PR` 按钮，位置位于 pull/push/sync 操作组前。
    - 无有效当前分支时按钮禁用并提供原因提示。

- 后端命令体系（双命令）
    1. `get_git_pr_workflow_defaults`
        - 自动探测：`upstreamRepo / baseBranch / headOwner / headBranch / title / body / commentBody`。
        - 输出 `canCreate + disabledReason`，前端据此控制可执行性。
    2. `create_git_pr_workflow`
        - 标准流程：`precheck -> push -> create -> comment`。
        - 每阶段返回结构化状态与 detail（`pending/running/success/failed/skipped`）。

- 关键稳定性与恢复策略
    - 命令默认使用 token 隔离执行：`env -u GH_TOKEN -u GITHUB_TOKEN`。
    - push 命中 HTTP2 传输错误时自动单次 HTTP/1.1 fallback。
    - 先检测 existing PR（`gh pr list --state all --head ...`），命中则复用并跳过 create。
    - 预检包含 `gh --version` / `gh auth status` / `upstream` 范围门禁检查（`upstream/<base>...HEAD`）。

- 前端弹窗与交互
    - 新增 Create PR 弹窗（集成在 GitHistoryPanel）：
        - compare 参数条：`base repository / base / head repository / compare`。
        - 使用可搜索下拉选择器（非原生 datalist），支持稳定弹层、过滤、选中态。
        - 标题、描述、可选评论开关与评论正文可编辑。
    - 阶段进度区支持 4 阶段可视化反馈；comment 失败不影响 PR 已创建主结果。
    - 结果区支持：打开 PR、复制链接、复制重试命令、显示 nextActionHint。

- 视觉与易用性优化（基于已落地代码）
    - 弹窗宽度与 compare 区排版增强，减少长仓库名/分支名拥挤。
    - compare 条与下拉菜单统一视觉规范（对齐、层级、hover/active、滚动边界）。
    - 选项与当前值支持 tooltip 完整查看，兼顾整洁与可追溯。

## 方案对比与取舍

| 选项 | 描述                            | 优点               | 缺点                             | 结论  |
|----|-------------------------------|------------------|--------------------------------|-----|
| A  | 仅提供“打开 GitHub compare 页面”快捷入口 | 改造最小             | 仍需手工 push/create/comment，失败恢复弱 | 不采纳 |
| B  | 顶栏 `PR` + 参数弹窗 + 后端工作流编排      | 流程闭环、稳定性强、可观测可恢复 | 前后端联动复杂度较高                     | 采纳  |
| C  | 完全静默自动创建 PR                   | 操作最少             | 高风险，缺少关键确认门与纠偏点                | 不采纳 |

## Capabilities

### New Capabilities

- `git-pr-submission-workflow`：在客户端内执行 GitHub PR 提交流水线，并返回阶段化结构结果。

### Modified Capabilities

- `git-history-panel`：新增 `PR` 入口、Create PR 弹窗、compare 参数条、阶段反馈与结果操作。
- `git-operations`：新增 PR 工作流稳定性约束（token 隔离、协议 fallback、范围门禁、错误分类）。

## 验收标准

- 顶栏出现 `PR` 按钮，且不破坏现有 pull/push/sync/fetch/refresh 操作顺序。
- 打开弹窗后可预填并编辑 PR 参数，compare 条可搜索选择。
- 提交流程可展示 4 阶段状态：precheck/push/create/comment。
- 成功返回可打开 PR 链接；失败返回可操作 hint；push 失败可提供 retry command。
- 命中 existing PR 时不重复创建，结果态可直接打开已有 PR。
- 命中 HTTP2 push 错误时会触发 HTTP/1.1 fallback，并在阶段信息中可见。
- 范围门禁异常时在 precheck 阶段阻断，避免超范围 PR 提交。

## Impact

- Backend
    - `src-tauri/src/git/mod.rs`
    - `src-tauri/src/types.rs`
    - `src-tauri/src/lib.rs`
- Frontend
    - `src/features/git-history/components/GitHistoryPanel.tsx`
    - `src/services/tauri.ts`
    - `src/types.ts`
    - `src/i18n/locales/zh.ts`
    - `src/i18n/locales/en.ts`
    - `src/styles/git-history.css`
- Tests
    - `src/features/git-history/components/GitHistoryPanel.test.tsx`
    - `src-tauri/src/git/mod.rs`（workflow 相关 Rust tests）
