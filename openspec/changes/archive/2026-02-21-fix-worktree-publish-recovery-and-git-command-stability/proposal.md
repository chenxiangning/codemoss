## Why

当前 Git 操作链路在长耗时/认证交互场景下存在“卡住且不可恢复”的风险：`pull/sync/fetch` 可能因隐藏交互提示长时间无响应，worktree
创建后的发布失败会让用户误判为整体失败。随着 Git 历史面板和 worktree 工作流成为高频入口，这个问题已影响稳定性与可恢复性，需立即修复。

## 目标与边界

- 目标：让核心 Git 操作在超时与认证异常下可感知、可恢复、可重试。
- 目标：确保 worktree 本地创建成功与远端发布失败能够被明确区分，并提供重试路径。
- 边界：本次不改变 Git 功能语义（如 pull/push 策略本身），仅强化执行可靠性、错误建模与前端反馈。

## 非目标

- 不新增新的 Git 操作类型。
- 不重做 Git 历史面板整体 UI 信息架构。
- 不引入新的远端协议或认证机制。

## What Changes

- 为 `pull/sync/fetch` 增加非交互执行环境与统一超时控制（120s），避免隐藏认证提示导致阻塞。
- 在执行长耗时 Git 命令前释放 workspace 锁，降低命令链路互锁风险。
- 将 worktree “本地创建 + 可选发布”结果拆分建模：本地成功时即返回成功主状态；发布失败通过 `publishError` 与
  `publishRetryCommand` 暴露可恢复信息。
- 前端在 worktree 创建结果中展示 warning 与重试命令，并在创建期间显示明确 `creating` 状态，避免重复提交。
- 将 worktree 创建结果从系统 message 升级为应用内自定义弹窗：加入状态 icon、分层排版、红色重点告警区、命令一键复制与显式关闭，提升可读性与可恢复操作效率。
- 完善 Git 超时/认证错误 i18n 映射与前后端测试覆盖，保证错误可读且可操作。
- Git History 顶部操作错误提示改为“错误常驻 + 手动关闭”，不再统一 5 秒自动消失；成功提示可继续短时自动消失。
- 删除本地分支时增强 worktree 占用场景处理：先尝试清理陈旧 worktree 元数据（prune）再重试删除；若仍被活跃 worktree
  占用，返回更明确的可操作错误信息。
- 删除分支流程增加“二次确认强删”分支：当命中 `not fully merged` 或 `used by worktree` 时，提供高风险确认弹窗，确认后执行强制删除（并可一并移除占用
  worktree）。
- 强删确认弹窗 UI 升级：加入危险图标、红色风险提示区、关键对象信息（分支名/占用 worktree 路径）、路径一键复制、确认按钮倒计时解锁，降低误触风险并提升可读性。
- worktree 创建结果弹窗 UI 升级：在“本地成功但远端发布失败”时必须展示红色重点告警区与可复制重试命令；在成功场景展示成功
  icon 与清晰状态摘要。

## 方案对比与取舍

| 选项 | 描述                                         | 优点                    | 缺点                   | 结论  |
|----|--------------------------------------------|-----------------------|----------------------|-----|
| A  | 保持现状，仅补充文案提示                               | 改动小、上线快               | 无法解决阻塞与恢复问题，用户仍会卡死   | 不采纳 |
| B  | 增加命令超时与错误提示，但不调整 worktree 结果模型             | 能缓解部分阻塞               | 仍无法表达“本地成功/远端失败”分离语义 | 不采纳 |
| C  | 统一执行稳定性（非交互+超时+锁策略）并重构 worktree 发布结果为可恢复模型 | 可靠性与可恢复性完整闭环，符合现有用户心智 | 需要同步前后端类型与测试         | 采纳  |

## Capabilities

### New Capabilities

- 无

### Modified Capabilities

- `git-operations`: 为 `pull/sync/fetch` 增加非交互执行、超时失败语义与可读错误映射要求。
- `git-worktree-base-selection`: 强化“本地创建成功 + 远端发布失败”的分离结果表达与重试指令展示要求。
- `git-history-panel`: 调整顶部操作通知生命周期策略，错误提示默认常驻并支持显式关闭。
- `git-branch-management`: 强化“删除分支被 worktree 占用”场景的可恢复与可读错误语义。

## 验收标准

- `pull/sync/fetch` 在无交互认证提示场景下会在超时后返回可识别错误，而非无限等待。
- 相关长耗时 Git 执行期间不会因 workspace 锁导致链路阻塞放大。
- worktree 本地创建成功但发布失败时，UI 明确显示本地成功、发布 warning、可复制的重试命令。
- 创建按钮在执行期间为 `creating` 态并阻止重复触发。
- i18n 错误映射与对应前后端测试通过。
- 任一 Git 操作失败后，Git History 红色错误提示在 5 秒后不会自动消失，且用户可通过显式关闭按钮清除提示。
- 删除分支命中“used by worktree”时，系统会先执行一次 worktree 元数据清理并自动重试；若仍失败，提示需先切换或移除占用该分支的
  worktree。
- 删除分支命中“not fully merged”或“used by worktree”时，系统会弹出二次强删确认；用户确认后才执行强制删除。
- 强删确认弹窗必须展示红色高危提示与关键对象信息；当存在占用 worktree 路径时，用户可一键复制该路径；强删按钮需在短倒计时后才可点击。

## Impact

- Backend
    - `src-tauri/src/git/mod.rs`
    - `src-tauri/src/shared/workspaces_core.rs`
    - `src-tauri/src/codex/home.rs`
    - `src-tauri/src/types.rs`
- Frontend
    - `src/features/git-history/components/GitHistoryPanel.tsx`
    - `src/services/tauri.ts`
    - `src/features/workspaces/components/WorktreePrompt.tsx`
    - `src/features/workspaces/components/WorktreeCreateResultDialog.tsx`
    - `src/features/workspaces/hooks/useWorktreePrompt.ts`
    - `src/features/git-history/gitErrorI18n.ts`
    - `src/types.ts`
    - `src/i18n/locales/en.ts`
    - `src/i18n/locales/zh.ts`
    - `src/styles/git-history.css`
- Tests
    - `src/features/git-history/components/GitHistoryPanel.test.tsx`
    - `src-tauri/src/workspaces/tests.rs`
    - `src/features/workspaces/components/WorktreePrompt.test.tsx`
    - `src/features/workspaces/components/WorktreeCreateResultDialog.test.tsx`
    - `src/features/workspaces/hooks/useWorktreePrompt.test.tsx`
    - `src/features/git-history/gitErrorI18n.test.ts`
