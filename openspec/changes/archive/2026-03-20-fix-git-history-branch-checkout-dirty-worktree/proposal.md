## Why

当前在 Git History 面板执行分支“签出”时，存在“分支指示已切换，但工作区出现大量非预期差异文件”的问题。该问题会直接破坏用户对签出操作的信任，并阻塞后续提交、变基、合并等核心链路，必须优先修复。

## 目标与边界

- 目标：确保在工作区干净（clean）的前提下，分支签出后仍保持 clean，不引入额外脏文件。
- 目标：统一本地分支与远端跟踪分支的签出语义，保证行为一致、结果可预期。
- 边界：本提案仅覆盖签出链路与相关错误处理，不重做 Git History 面板的整体 UI 布局与交互信息架构。
- 边界：本提案不扩展为完整的“自动 stash/discard”向导，仅保证 clean checkout 的正确性与失败可诊断性。

## 非目标

- 不在本提案中实现新的分支管理能力（如批量签出、批量切换策略）。
- 不在本提案中修改 create/delete/merge/rebase/reset 等其他 Git 操作语义。
- 不在本提案中引入新的外部 Git SDK；优先复用现有 Git CLI 与现有错误映射框架。

## What Changes

- 明确“clean checkout”行为契约：若签出前工作区 clean，则签出后工作区必须保持 clean。
- 修复本地分支签出实现，消除“只切分支指针、工作区未完整对齐”导致的脏文件残留。
- 对齐本地/远端签出执行路径的语义一致性，避免同一操作在不同来源分支上产生不同行为。
- 明确 dirty checkout 在本次范围内维持“阻断 + 明确提示”语义：提示用户先 commit/stash/discard 后再重试，不在本次引入 stash/discard 向导流程。
- 增补签出后的结果校验与错误提示：若出现异常脏状态，向用户返回可执行的诊断与恢复信息。
- 补齐回归测试：覆盖“分支 A/B 有大量文件差异，反复切换后仍 clean”的场景。

## 技术方案对比

### 方案 A：保留 libgit2 本地签出链路，仅补齐 checkout 选项与基线控制

- 优点：改动范围小，保留当前内部抽象。
- 缺点：行为细节高度依赖 libgit2 语义，维护复杂，和当前远端签出路径（Git CLI）长期分叉。

### 方案 B：将本地分支签出统一到 Git CLI 语义（本次选择）

- 优点：与用户日常 `git checkout/switch` 行为一致，可预测性高；本地/远端签出路径一致，降低分叉风险。
- 缺点：需要补齐少量错误映射与测试，确保跨平台命令表现一致。

取舍：选择方案 B，以“行为正确性与语义一致性”优先，降低后续维护熵增。

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `git-branch-management`：强化 branch checkout requirement，新增“clean precondition -> clean postcondition”与异常脏状态兜底约束。

## 验收标准

- 在分支 A、B 存在大量文件差异且签出前为 clean 的前提下，A -> B 签出后 `git status` 仍为 clean。
- 连续执行 A -> B -> A 多次切换，不得累计出现 residual staged/unstaged entries。
- 当签出失败时，系统不得伪装成功（不得仅更新当前分支指示），并需返回可读错误信息。
- 当工作区非 clean 时，签出操作必须被阻断并给出 commit/stash/discard 指引文案。
- 本地分支签出与远端跟踪分支签出在 clean 场景下的结果一致（均保持 clean）。
- 相关最小回归测试通过（后端签出链路 + Git History 面板关键交互链路）。

## 风险与回滚

- 风险：切换到统一 Git CLI 后，跨平台错误文案可能出现差异。
- 控制：沿用现有错误归一化映射，补齐关键错误样本测试。
- 回滚：提供明确的代码级回滚步骤（revert 本次 checkout 变更提交 + 重新发版），避免依赖未实现的运行时开关。

## Impact

- Affected specs:
  - `openspec/specs/git-branch-management/spec.md`
- Affected backend areas（预期）:
  - `src-tauri/src/git/commands.rs`（checkout 命令执行路径）
  - `src-tauri/src/git_utils.rs`（checkout helper 行为调整或收敛）
- Affected frontend areas（预期）:
  - `src/features/git-history/components/git-history-panel/*`（签出后状态反馈与错误提示链路）
- Affected tests（预期）:
  - `src-tauri` Git 命令相关测试
  - `src/features/git-history/components/GitHistoryPanel.test.tsx`
