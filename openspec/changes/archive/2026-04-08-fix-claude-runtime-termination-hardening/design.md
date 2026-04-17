## Context

本变更是对已合入代码（`c9fef9c`）的 OpenSpec 回填，目标是把 `Claude` 子进程终止链路从“分散 kill”统一为“单一终止原语”，并在 `interrupt` 路径消除锁内等待子进程终止的结构性风险。

## Goals / Non-Goals

**Goals**
- 跨平台终止行为可预测，Windows 具备进程树清理能力。
- `interrupt` 先释放 `active_processes` 锁，再逐子进程终止。
- AskUserQuestion 恢复/失败与 turn 级中断统一复用终止 helper。

**Non-Goals**
- 不扩展新的 UI 交互或配置项。
- 不改造 Codex/OpenCode 终止模型。
- 不重构全引擎生命周期状态机。

## Decisions

### Decision 1: 统一终止原语 `terminate_child_process`

- 先 `try_wait` 判定已退出，避免重复 kill。
- Windows 优先 `taskkill /T /F`，确保进程树级回收。
- fallback 使用 `kill + wait`，并返回可诊断错误。

### Decision 2: `interrupt` 采用“drain then terminate”模式

- 在锁内只做 `drain`，把 `Child` 句柄移出共享 map。
- 锁外执行逐进程终止，收集首个失败，且总是清理 ephemeral 状态。

### Decision 3: AskUserQuestion / turn 中断路径全部收敛

- `interrupt_turn`、`stop_child_after_resume_failure`、`handle_ask_user_question_resume` 不再保留 ad-hoc `kill/wait` 逻辑。
- 统一调用 helper，减少语义漂移和后续维护成本。

## Risks / Trade-offs

- [Risk] `taskkill` 命令执行失败导致终止不完全  
  → Mitigation: 保留 fallback `kill + wait` 并记录 warning。

- [Risk] 部分终止失败时行为不一致  
  → Mitigation: 采用“返回首个错误 + 状态清理始终执行”策略，避免卡死。

## Verification Plan

1. 静态验证：确认所有 Claude 终止入口均引用 `terminate_child_process`。
2. 行为验证：执行 Rust 目标测试并回填到 `tasks.md` 的 3.2 项。
3. 非目标回归：确认本变更未触及 Codex/OpenCode 终止路径代码。
