## Why

`Claude` 运行时在子进程终止路径上存在两类已在代码中落地修复、但尚未进入 OpenSpec 的行为差异：

- Windows 下仅调用 `child.kill()` 可能无法递归清理进程树，存在残留子进程风险。
- `interrupt()` 在持有 `active_processes` 锁期间执行终止，容易放大锁竞争窗口并降低中断稳定性。

另外，`AskUserQuestion` 恢复/失败路径与单 turn 中断路径此前使用了分散的终止实现，语义不一致，增加回归面。

## 目标与边界

### 目标

- 统一 `Claude` 子进程终止语义，确保跨平台（尤其 Windows）行为可预测。
- 约束 `interrupt()` 为“先释放共享锁，再逐个终止子进程”的执行模型，避免锁内 `await kill`。
- 将 `interrupt_turn` 与 `AskUserQuestion` 相关路径统一收敛到同一终止原语。

### 边界

- 本次仅覆盖 `Claude` runtime 子进程终止与中断链路。
- 不改造 `Codex`/`OpenCode` 的中断实现。
- 不引入新的外部配置项与 UI 交互。

## 非目标

- 不重写多引擎统一生命周期状态机。
- 不调整上游 CLI 协议。
- 不扩展新的会话存储结构。

## What Changes

- 新增统一终止函数 `terminate_child_process`：
  - 终止前先 `try_wait`，对已退出进程直接 no-op。
  - Windows 路径优先 `taskkill /PID <pid> /T /F` 递归清理进程树。
  - 非 Windows 或 `taskkill` 失败时回退 `child.kill()` + `wait()`。
- `interrupt()` 改为先 `drain active_processes` 后再逐个终止，并保留“收集首个错误 + 始终清理状态”语义。
- `interrupt_turn()`、`stop_child_after_resume_failure()`、`handle_ask_user_question_resume()` 统一复用终止函数。

## 技术方案对比与取舍

| 方案 | 描述 | 优点 | 风险/成本 | 结论 |
|---|---|---|---|---|
| A. 保持分散 `kill()` 调用 | 各路径继续直接 `child.kill()` | 改动最小 | Windows 进程树残留与锁竞争风险持续 | 不采用 |
| B. 统一终止原语 + 锁外终止（本次） | 所有 Claude 终止路径统一到 helper，并调整 `interrupt` 执行时序 | 行为一致、跨平台稳定、可审计 | 需要覆盖多路径回归 | **采用** |
| C. 全引擎统一重构 | 抽象 Claude/Codex/OpenCode 一体化终止框架 | 长期一致性最好 | 范围过大，交付周期不可控 | 本次不采用 |

## 验收标准

- [x] Windows 路径下，Claude 子进程终止 MUST 支持进程树级清理（`taskkill /T /F`）。
- [x] `interrupt()` MUST 不在持有 `active_processes` 锁时执行子进程终止等待。
- [x] `interrupt_turn` 与 AskUserQuestion 终止路径 MUST 复用统一终止函数。
- [x] 终止失败时 MUST 保留可诊断日志，并返回稳定错误结果。
- [ ] 目标回归测试（Rust）完成并记录结果。

## Capabilities

### New Capabilities

- `claude-runtime-termination-hardening`: 规范 Claude 子进程终止的跨平台一致性、锁竞争控制与路径收敛要求。

### Modified Capabilities

- None.

## 代码证据（Backfill）

- Commit: `c9fef9c` (`fix(engine): 优化 Claude 子进程终止逻辑，修复 Windows 进程树清理与锁竞争问题`)
- Evidence:
  - `src-tauri/src/engine/claude.rs:665-719`（统一终止函数与 Windows `taskkill`）
  - `src-tauri/src/engine/claude.rs:723-794`（`interrupt` 锁外终止 + `interrupt_turn` 复用）
  - `src-tauri/src/engine/claude/user_input.rs:4-18,223-233`（AskUserQuestion 路径复用）

## Impact

- Backend:
  - `src-tauri/src/engine/claude.rs`
  - `src-tauri/src/engine/claude/user_input.rs`
- Specs:
  - 新增 delta: `openspec/changes/2026-04-08-fix-claude-runtime-termination-hardening/specs/claude-runtime-termination-hardening/spec.md`
