## 1. 签出执行路径收敛（P0，前置）

- [x] 1.1 梳理本地/远端分支签出现有调用分叉（输入：`checkout_git_branch` 当前实现；输出：分叉点清单与目标统一路径；验证：设计评审通过，预计 < 2h）。
- [x] 1.2 将本地分支签出收敛到统一语义路径（依赖：1.1；输入：本地分支名；输出：与远端跟踪分支一致的签出行为；验证：手工用例 `clean A->B` 不产生脏文件，预计 < 2h）。

## 2. 一致性校验与错误语义（P0，依赖 1.x）

- [x] 2.1 增加签出后最小一致性校验（依赖：1.2；输入：checkout 返回结果；输出：分支状态与工作树状态一致性检查；验证：异常路径可捕获并返回错误，预计 < 2h）。
- [x] 2.2 补齐失败路径语义（依赖：2.1；输入：checkout 失败场景；输出：禁止伪成功并返回可读错误；验证：前端操作提示为失败且不更新成功提示，预计 < 2h）。

## 3. 前端联动与反馈稳定性（P0，依赖 2.x）

- [x] 3.1 校准 Git History 面板签出后的刷新与提示链路（依赖：2.2；输入：签出成功/失败状态；输出：成功才展示成功提示、失败保留错误提示；验证：交互用例通过，预计 < 2h）。
- [x] 3.2 复核分支指示与工作区摘要同步时序（依赖：3.1；输入：签出操作完成事件；输出：分支标识与工作区 changed-files 计数一致；验证：无“分支已切但工作区异常”的 UI 假象，预计 < 2h）。
- [x] 3.3 对齐 dirty checkout 的前端提示语义（依赖：2.2；输入：dirty checkout 后端错误模型；输出：明确 commit/stash/discard 指引，不出现 stash/discard 向导入口；验证：dirty 场景交互断言通过，预计 < 2h）。

## 4. 回归测试补齐（P0，依赖 1.x~3.x）

- [x] 4.1 增加后端签出回归测试（依赖：2.2；输入：A/B 分支文件集差异样本；输出：clean A->B->A 循环测试；验证：测试断言始终 clean，预计 < 2h）。
- [x] 4.2 增加前端关键交互回归测试（依赖：3.2,3.3；输入：Git History 签出交互；输出：成功/失败提示与状态刷新断言 + dirty 阻断提示断言；验证：`GitHistoryPanel` 相关测试通过，预计 < 2h）。

## 5. 质量门禁与回滚演练（P0，收尾）

- [x] 5.1 运行最小质量门禁（依赖：4.1,4.2；输入：改动分支；输出：目标测试通过 + 类型检查通过；验证：测试命令与 typecheck 均 green，预计 < 2h）。
- [x] 5.2 执行异常回滚演练（依赖：5.1；输入：签出回归异常假设；输出：`git revert` 级别的快速回滚操作步骤；验证：回滚步骤文档化并人工验证，预计 < 2h）。

## 回滚演练记录（2026-03-20）

异常假设：上线后再次出现“checkout 成功但工作区残留脏文件”。

快速回滚步骤（提交级）：
1. 定位本次修复提交：
   - `git log --oneline -- src-tauri/src/git/commands.rs src-tauri/src/git/mod.rs src/features/git-history/components/GitHistoryPanel.test.tsx`
2. 执行回滚：
   - `git revert <fix-commit-sha> --no-edit`
3. 回滚后最小验证：
   - `cd src-tauri && cargo test checkout_roundtrip_between_divergent_branches_stays_clean`
   - `pnpm vitest run src/features/git-history/components/GitHistoryPanel.test.tsx`
   - `pnpm tsc --noEmit`
4. 若验证通过，发布回滚版本。
