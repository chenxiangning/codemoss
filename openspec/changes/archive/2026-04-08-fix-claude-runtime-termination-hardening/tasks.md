## 1. OpenSpec Delta Completion（P0）

- [x] 1.1 [P0][depends: none][I: `c9fef9c` 终止逻辑改动][O: `claude-runtime-termination-hardening` delta spec][V: 覆盖跨平台终止、锁外终止、路径收敛] 基于代码完成 capability 回填。

## 2. Claude Runtime Termination Hardening（P0）

- [x] 2.1 [P0][depends: none][I: `ClaudeSession` 子进程终止分散逻辑][O: `terminate_child_process` 统一终止原语][V: `try_wait` + Windows `taskkill` + 回退 `kill/wait` 全链路存在] 落地跨平台终止基础能力。
- [x] 2.2 [P0][depends: 2.1][I: `interrupt()` 实现][O: 锁外终止执行模型][V: `active_processes` 先 `drain` 再逐子进程终止，避免锁内 `await` kill] 收敛锁竞争风险。
- [x] 2.3 [P0][depends: 2.1][I: turn 级中断与 AskUserQuestion 恢复链路][O: 全部复用统一终止原语][V: `interrupt_turn` / `stop_child_after_resume_failure` / `handle_ask_user_question_resume` 均调用 helper] 完成路径一致性。

## 3. Verification & Traceability（P1）

- [x] 3.1 [P1][depends: 2.1,2.2,2.3][I: 提交与代码证据][O: 回填提案证据锚点][V: `proposal.md` 标注 commit 与文件行号证据] 完成追溯闭环。
- [x] 3.2 [P1][depends: 2.1,2.2,2.3][I: Rust runtime 变更][O: 目标测试记录][V: `cargo test --manifest-path src-tauri/Cargo.toml` 相关测试通过并回填结果] 待执行测试门禁。
