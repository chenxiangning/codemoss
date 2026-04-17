# Git History Panel - Implementation Tasks (Deliverable v1)

## A. M0 已落地（与 proposal 对齐）

- [x] A1 新增 `gitHistory` app mode，并接入 Sidebar 入口
- [x] A2 三端布局接入 Git History 视图（Desktop/Tablet/Phone）
- [x] A3 Desktop 底部 dock 形态 + 拖拽调整高度 + 本地持久化
- [x] A4 新建工作台结构：`Overview + Branches + Commits + Details`
- [x] A5 实现后端 `get_git_commit_history`（分页 + 基础筛选）
- [x] A6 实现后端 `get_git_commit_details`（metadata/files/diff/stats）
- [x] A7 实现分支接口：list/checkout/create/create-from-commit/delete/rename/merge
- [x] A8 实现操作接口：pull/push/sync/fetch/cherry-pick/revert
- [x] A9 分支名校验切换为 Git ref 规则（允许 `/`）
- [x] A10 checkout 增加 dirty working tree 保护
- [x] A11 前端接入操作状态与错误反馈，Revert/Delete/Merge 增加确认
- [x] A12 详情区文件树与提交信息分割拖拽能力
- [x] A13 大 diff 截断提示与 binary 文件友好提示
- [x] A14 历史基础键盘导航（`↑` / `↓` / `Esc`）与焦点管理
- [x] A15 四区域默认宽度比例 `3:2:3:2` 与三条竖向拖拽条
- [x] A16 非 Git 工程空态改为工作区选择页（含 Git root fallback）
- [x] A17 提交详情树支持目录链合并（`a.b.c`）显示
- [x] A18 点击文件弹出 diff 窗体预览，保留主布局与提交信息区
- [x] A19 弹窗 diff 深浅主题对比度修复（跟随全局 theme token）
- [x] A20 工作区（Staged/Unstaged）树视图支持目录链合并（`a.b.c`）显示
- [x] A21 分支树视觉优化：HEAD 文本着色、当前分支左边框、`MAIN/ZH` 特殊徽标、本地/远程分组 icon
- [x] A22 操作结果提示优化：拉取/推送/同步/获取/刷新完成后显示成功/失败反馈，5 秒自动消失

## B. M1 缺口收敛（下一阶段）

- [x] B1 Commit 列表虚拟滚动（10k+ commits 可用）
- [x] B2 `snapshotId` 真正参与翻页会话（请求入参 + 稳定分页）
- [x] B3 `jumpTo` 能力（hash/ref 快速定位）
- [x] B4 diff 模式切换（unified/split）与 chunk navigation
- [x] B5 面板状态持久化（列宽、筛选、选中 commit）
- [x] B6 操作失败统一错误模型（`userMessage/debugMessage/retryable`）
- [x] B7 自动化测试补齐（Rust/前端/集成）
- [x] B8 `git/mod.rs` 按职责拆分（可选工程化收敛，不阻塞 v1）

## C. 质量门禁（归档前）

- [x] C1 Rust 测试：history 分页、branch 操作、冲突路径
- [x] C2 前端测试：关键交互与状态恢复
- [x] C3 集成链路：打开面板 -> 选 commit -> 点击文件弹窗查看 diff -> 执行操作
- [x] C4 性能回归：10k+ commits 场景指标达标
- [x] C5 文档对齐复核：proposal/design/specs/tasks 一致性检查
- [x] C6 归档前验证：`openspec validate git-history-panel --strict`
