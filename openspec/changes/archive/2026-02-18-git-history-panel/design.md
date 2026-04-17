# Git History Panel - Design

## Context

本次设计目标是为 CodeMoss 提供一条稳定的 Git History 主链路，而不是继续把 Git 体验限定在 working tree 视角。

当前已落地（M0）形态：

- Sidebar 进入 `gitHistory` 模式
- Desktop 为底部 dock（可拖拽调高）
- Tablet/Phone 直连 Git History 视图
- 工作台结构为 `Overview + Branches + Commits + Details`

## Goals

1. **可用性**：单面板完成“看历史 + 看差异 + 做操作”。
2. **一致性**：proposal/design/tasks/specs 语义保持一致，避免文档漂移。
3. **可演进性**：M0 可用，M1 逐步补齐虚拟滚动、snapshot 会话和 split diff。
4. **安全性**：写操作必须有清晰状态反馈与必要确认。

## Non-Goals

- v1 不做 interactive rebase / reflog。
- v1 不做图片二进制前后对比。
- v1 不做多提交批量操作。

## Architecture Lens

参考 IDEA VCS Log 的分层思想，但不做 1:1 复刻：

- Data（原始 Git 数据）
- Visible（筛选后可见集合）
- Render（可渲染结构）

在 CodeMoss 中对应到“Rust 命令层 + React 工作台 + 可演进渲染层”。

## High-Level Architecture

```text
Git Repository
   |
   v
Backend Command Layer (current: src-tauri/src/git/mod.rs)
   |
   +-- History query (get_git_commit_history)
   +-- Commit details (get_git_commit_details)
   +-- Branch ops (list/checkout/create/delete/rename/merge)
   +-- Git ops (pull/push/sync/fetch/cherry-pick/revert)
   |
   v
Frontend GitHistoryPanel
   |- Toolbar actions
   |- Overview pane
   |- Branches pane
   |- Commits pane
   |- Details pane (file tree + commit message split)
   |- FileDiffModal (click file to open diff preview)
```

## Core Data Contracts (M0)

### `GitHistoryCommit`

- `sha`, `shortSha`, `summary`, `message`
- `author`, `authorEmail`, `timestamp`
- `parents[]`, `refs[]`

### `GitCommitDetails`

- `sha`, `summary`, `message`
- `author/committer` + time fields
- `files[]`（含 `status/additions/deletions/diff/isBinary/lineCount/truncated`）
- `totalAdditions`, `totalDeletions`

### `GitBranchListItem`

- `name`, `isCurrent`, `isRemote`, `remote`
- `lastCommit`, `ahead`, `behind`

## Decision 1: History Query Pipeline

**Target（M1）**：`snapshotId + offset/limit` 会话化分页。  
**Current（M0）**：已支持 `offset/limit` 与筛选，`snapshotId` 仅作为返回值，尚未作为入参参与分页会话。

### Why

- 大仓库下要避免全量加载。
- 刷新与分页并存时需要稳定游标，避免重复/漏项。

## Decision 2: Commit Graph Rendering

**Current（M0）**：使用 `HTML + CSS` 轻量图形线条。  
**Target（M1）**：在不破坏接口的前提下再升级虚拟滚动渲染性能。

### Why

- 与现有 React 体系一致，调试成本低。
- 先交付可用，再优化极端规模性能。

## Decision 3: Diff Loading Strategy

**Current（M0）**：`get_git_commit_details` 返回提交级文件列表与文件 diff；详情区文件树点击后弹窗展示 diff（不改动主布局）。  
**Target（M1）**：支持 split diff / chunk navigation，必要时再细化到单文件按需拉取。

### Why

- M0 先保证体验闭环。
- M1 再针对大 diff 交互与性能优化。

## Decision 4: Git Operation Execution Model

**Current（M0）**：混合模型。

- 读取/分析类（history/details/branch 元信息）主要走 `git2`。
- 写操作与部分网络操作（pull/push/fetch/cherry-pick/revert 等）通过 `git` 命令执行。

**Target（M1）**：保持 contract 稳定，逐步收敛错误模型与并发控制。

## Decision 5: Branch Name Validation

使用 Git ref 规则校验本地分支名（允许 `/`），与 Git 原生行为一致。

## Decision 6: Error Model

**Current（M0）**：前端对常见 Git 错误做本地化映射（例如 dirty working tree）。  
**Target（M1）**：统一为结构化错误模型（`userMessage/debugMessage/retryable`），并补齐操作完成态通知（成功/失败结果条，5 秒自动消失）。

## Frontend Design

### Component Tree (M0)

```text
GitHistoryPanel
  |- Toolbar (pull/push/sync/fetch/refresh)
  |- OverviewPane (working tree summary + view toggles)
  |- BranchesPane (grouped local/remote + actions)
  |- CommitsPane (paged list + search)
  |- DetailsPane
       |- Metadata
       |- FileList (flat/tree)
       |- SplitResizer
       |- CommitMessageView
  |- FileDiffModal
```

### State Strategy (M0)

- 本地组件状态管理（`useState/useMemo/useCallback`）。
- 通过 `services/tauri.ts` 直接调用命令。
- 布局相关持久化由 `App.tsx` 写入 client store（例如 panel height）。

## Backend Design

### Current (M0)

- `src-tauri/src/git/mod.rs` 承担历史、详情、分支、操作命令。
- `src-tauri/src/types.rs` 扩展 Git History 相关数据结构。
- `src-tauri/src/lib.rs` 注册新增命令。

### Evolution (M1)

- 在不破坏前端 contract 的前提下，按职责拆分 `git/mod.rs`（可选工程化收敛项）。

## Tauri Command Contracts (M0)

### History

- `get_git_commit_history(workspaceId, branch?, query?, author?, dateFrom?, dateTo?, offset, limit)`
- out: `snapshotId, total, offset, limit, hasMore, commits[]`

### Commit Details

- `get_git_commit_details(workspaceId, commitHash, maxDiffLines?)`
- out: `metadata + files[] + totals`

### Branch

- `list_git_branches`
- `checkout_git_branch`
- `create_git_branch`
- `create_git_branch_from_commit`
- `delete_git_branch`
- `rename_git_branch`
- `merge_git_branch`

### Operations

- `git_pull`
- `git_push`
- `git_sync`
- `git_fetch`
- `cherry_pick_commit`
- `revert_commit`

## UX Rules (M0)

1. 分支切换后刷新历史与详情。
2. 提交选中后自动选择可用文件。
3. 写操作进行中禁用冲突动作，避免重复触发。
4. 危险动作（delete/merge/revert）必须二次确认。
5. 点击文件后以弹窗方式展示 diff，不挤压详情主布局。
6. Diff 过大或 binary 文件给出明确提示，不阻塞界面。

## Implementation Delta (2026-02-18)

### 已对齐 proposal 的落地项

- 多端入口 + Desktop 底部 dock + 高度持久化
- Overview 区、分支树分组、提交分页与搜索
- 详情区文件树、提交信息分割拖拽 + 文件点击弹窗 diff
- 工作区（Staged/Unstaged）树视图目录链合并（`a.b.c`）
- 分支树视觉规则对齐（`HEAD` 文本着色、当前分支左边框、`MAIN/ZH` 特殊徽标、本地/远程分组 icon）
- 常用 Git 操作与分支操作链路可用
- Git 操作完成态反馈（成功/失败信息条，5 秒自动消失）
- 大 diff 截断与 binary 保护 + 弹窗主题对比度修复

### M1 收敛结果

- Commit 列表虚拟滚动（含 10k+ 提交场景）
- `snapshotId` 入参化会话分页 + 过期刷新
- jumpTo（hash/ref）
- 弹窗 diff unified/split 切换与 chunk navigation
- 统一错误模型（`userMessage/debugMessage/retryable`）
- 自动化测试补齐（Rust/前端/集成）

## Performance Budget

- 首屏历史加载目标：100 commits 在 1.2s 内。
- 目标滚动流畅性：10k+ commits 场景可用（已落地虚拟滚动）。
- 详情加载目标：普通提交 400ms 级别。

## Testing Strategy

### Backend

- 历史分页与筛选正确性
- 分支名校验与关键分支操作异常路径
- 写操作失败路径（冲突/dirty tree）

### Frontend

- 打开面板 -> 选提交 -> 点击文件弹窗看 diff -> 执行操作 主链路
- 分支分组与筛选交互
- 详情区文件树与提交信息分割交互

## Rollback Plan

- 若 Git History 面板出现严重问题，可通过切回 `appMode = chat` 回退到原主界面流。
- 后端命令保持增量式，不改写原有 Git 基础能力，可按命令级快速回退。
