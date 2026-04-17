## Why

CodeMoss 当前 Git 面板偏向「工作区变更（working tree）」而不是「历史演进（history log）」。
在日常开发中，用户需要在同一界面完成以下闭环：

- 看分支与标签拓扑（而不只是当前分支）
- 看历史提交并快速定位（message / author / hash / 时间）
- 看单次提交影响（文件变更 + diff）
- 做常见 Git 操作（checkout / pull / push / fetch / cherry-pick / revert）

当前体验需要在多个面板与外部工具间切换，效率和可追溯性不足。

## What Changes

本提案目标是交付一个 **可落地的 IDEA 风格 Git Log v1**（不是 1:1 复刻 UI），并采用 M0/M1 渐进交付。

### M0（当前代码基线，已落地能力）

1. 入口与多端布局：
    - Sidebar 新增 `Git History` 模式入口（`appMode = gitHistory`）
    - Desktop/Tablet/Phone 均可进入 Git History 视图
    - Desktop 形态为底部 dock，可拖拽调整高度并持久化
2. 工作台结构：
    - 左侧 `Overview`（工作树状态摘要 + 展示模式切换）
    - 主区三栏：Branches / Commit Log / Commit Details
3. Branches 能力：
    - 本地/远程分组展示，支持 scope 折叠
    - 当前分支、高亮、ahead/behind 徽标
    - 搜索、checkout、新建、重命名、删除、合并
    - 支持“从指定提交创建分支”
4. Commit Log 能力：
    - 分页加载（每页 100）
    - message/hash 基础搜索
    - 选择提交后联动详情面板
5. Commit Details 能力：
    - 元数据、文件变更统计（A/M/D/R + +/-）
    - 文件平铺/树形浏览、默认文件选中、目录链合并显示（`a.b.c`）
    - 点击文件弹出 diff 窗体预览（不占用主布局）
    - binary 友好提示、大 diff 截断提示
    - 文件列表与提交信息区域可拖拽分割
6. Git 操作能力：
    - `pull/push/sync/fetch/refresh` 工具栏操作
    - `cherry-pick/revert` 提交级操作
    - 操作进行中状态与结果反馈（成功/失败提示，5 秒自动消失）
    - `revert/delete/merge` 二次确认；checkout 的 dirty-tree 保护
7. 后端命令与类型扩展：
    - `get_git_commit_history`
    - `get_git_commit_details`
    - `list_git_branches`
    - `checkout_git_branch`
    - `create_git_branch`
    - `create_git_branch_from_commit`
    - `delete_git_branch`
    - `rename_git_branch`
    - `merge_git_branch`
    - `git_pull` / `git_push` / `git_sync` / `git_fetch`
    - `cherry_pick_commit` / `revert_commit`

### M1（v1 完整体验，已完成）

- Commit 列表虚拟滚动（10k+ 提交稳定滚动）
- `snapshotId` 会话化翻页（请求入参与一致性保证）
- 跳转 commit（hash/ref）
- split diff 与 chunk navigation
- 面板状态持久化（列宽/筛选/选中 commit）
- 统一错误模型与自动化测试补齐（Rust/前端/集成）

## Delivery Strategy (落地分层)

为保证“先可用、再增强”，采用两阶段交付：

1. **M0（当前实现基线）**
    - 已交付可用工作台（overview + branches + history + details）
    - 后端核心 commands 打通
    - 常用写操作（pull/push/sync/fetch/cherry-pick/revert）可执行
    - 分页加载 + 基础搜索 + diff 预览可用
2. **M1（v1 完整体验）**
    - 虚拟滚动、跳转 commit、split diff、状态持久化
    - 更完整的确认流与失败重试 UX
    - 性能与测试门禁补齐

## Current Status (2026-02-18)

以下能力已在代码分支 `codex/feat-gitlog-v0.1.8` 的当前变更中落地：

- 已完成：
    - Git History 多端入口与布局接入（Desktop/Tablet/Phone）
    - Desktop 底部 dock 形态 + 拖拽高度调整 + 本地持久化
    - 四区域默认宽度比例（`3:2:3:2`）与三条竖向拖拽分隔
    - `get_git_commit_history` / `get_git_commit_details`
    - `list_git_branches` 扩展（local/remote/current + ahead/behind）
    - `checkout/create/delete/rename/merge` 分支操作
    - `git_pull/git_push/git_sync/git_fetch`
    - `cherry_pick_commit/revert_commit/create_git_branch_from_commit`
    - 非 Git 工程空态切换为工作区选择页（含 Git root fallback）
    - 非 Git 根识别修正为“仅校验当前工作区根路径”（禁用向父目录回溯）
    - 详情区文件树目录链合并（`a.b.c`）与文件点击弹窗 diff
    - 工作区（Staged/Unstaged）树视图目录链合并（`a.b.c`）
    - 分支树视觉优化：`HEAD` 文本着色 + 当前分支左边框高亮 + `MAIN/ZH` 特殊徽标 + 本地/远程分组 icon
    - 工具栏 Git 操作反馈优化：完成后显示成功/失败信息并自动 5 秒消失（失败带可重试提示）
    - 常见 Git 错误信息 i18n 归一化（前端用户提示与 debug 信息分离）
    - 弹窗 diff 深浅主题对比度修复（统一主题 token）
- M1 收敛完成：
    - Commit 列表虚拟滚动（10k+ 场景）
    - `snapshotId` 入参化会话分页 + 过期刷新
    - `jumpTo`（hash/ref）
    - 弹窗 diff unified/split 切换与 chunk navigation
    - 面板状态持久化（列宽/筛选/选中 commit/diff 模式）
    - 统一错误模型（`userMessage/debugMessage/retryable`）
    - 自动化验证补齐（Rust/前端/集成链路）

### v1.1+（明确延期，不阻塞 v1）

- 交互式 rebase
- reflog
- commit 签名校验 UI
- 图片二进制前后预览
- 多选 commits 批处理

## Capabilities

### New Capabilities

- `git-history-panel`
- `git-branch-management`
- `git-commit-history`
- `git-commit-details`
- `git-operations`

### Modified Capabilities

- `sidebar-navigation`（新增 Git History 入口和切换逻辑）

## IDEA Reference (Implementation Lens)

本提案不是猜测式设计，参考了本机 `IntelliJ IDEA 3.app`（`2025.2`, build `252.23892.409`）中的 VCS Log 模块结构信号：

- `intellij.platform.vcs.log.impl.jar`
- `com.intellij.vcs.log.visible.VisiblePack`
- `com.intellij.vcs.log.graph.impl.facade.VisibleGraphImpl`
- `com.intellij.vcs.log.ui.table.GraphTableModel`
- `com.intellij.vcs.log.visible.VisiblePackRefresherImpl`

据此我们采用同构思路：

- `DataPack`（原始数据）
- `VisiblePack`（筛选后可见集）
- `VisibleGraph`（可渲染行）

## Impact

### Frontend

- 新增模块：`src/features/git-history/`
- 修改：
    - `src/App.tsx`
    - `src/features/app/components/AppLayout.tsx`
    - `src/features/app/components/SidebarMarketLinks.tsx`
    - `src/features/layout/components/DesktopLayout.tsx`
    - `src/features/layout/components/TabletLayout.tsx`
    - `src/features/layout/components/PhoneLayout.tsx`
    - `src/services/tauri.ts`
    - `src/types.ts`
    - `src/i18n/locales/en.ts`
    - `src/i18n/locales/zh.ts`
- 新增样式：
    - `src/styles/git-history.css`

### Backend (Tauri / Rust)

- 修改：
    - `src-tauri/src/git/mod.rs`
    - `src-tauri/src/lib.rs`
    - `src-tauri/src/types.rs`

## Non-Goals

- 不追求完整复刻 IDEA 所有高级功能
- 不引入不可回滚的大规模架构重构
- 不在 v1 中处理全部极端 diff 展示特效（例如图像对比）

## Success Criteria

- 大仓库（10k+ commits）可稳定滚动浏览
- 常见操作（checkout/pull/push/fetch）成功率可观测
- 用户可以在一个面板内完成“看历史 + 看差异 + 执行操作”的主链路
- OpenSpec artifacts（proposal/design/specs/tasks）保持严格一致
