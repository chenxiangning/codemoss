## Context

当前问题不是 UI，而是会话真值层：Codex rewind 旧实现主要通过前端隐藏实现“看起来回退”，但回退尾部仍可能留在内存或磁盘，后续 reopen / history load / send 有机会再次读到。

本变更只做一件事：把 Codex rewind 语义改为真实截断，并在该语义上对齐 Claude Code。

当前实现已经完成核心链路，本 design 文档回写为 as-built 说明。

## Goals / Non-Goals

**Goals**

- rewind 成功后，锚点之后数据在内存与磁盘都被截断。
- 成功语义严格等于“截断已提交”。
- reopen / history load / send 统一读取截断后事实，不复现尾部。

**Non-Goals**

- 不做跨源聚合策略重构。
- 不做 UI 交互和文案调整。
- 不引入软删除或回退恢复能力。

## Design Decisions

### Decision 1: 单真值层在事实数据层（采用）

- 方案 A：继续 UI hidden map 作为主机制。
  - 问题：展示层与事实层双真值，容易漏口。
- 方案 B：rewind 直接截断会话事实数据，UI 只展示事实。
  - 结果：语义可验证，与 Claude 对齐。

取舍：采用方案 B。

**As Built**

- `rewind_codex_thread` 在后端先 `resume` 现有 thread，解析稳定锚点，再 `fork` child thread。
- child thread 创建成功后，`commit_codex_rewind_for_workspace` 负责把本地 jsonl 会话物理截断到锚点前。
- 本地截断写入采用 temp file + rename，成功后删除旧 session 文件，避免旧尾部继续暴露为真值。

### Decision 2: 成功返回必须晚于截断提交（采用）

- 方案 A：先回 UI 成功，再异步落盘。
  - 问题：会产生“成功但未真正截断”的竞态。
- 方案 B：截断提交完成后才返回成功。
  - 结果：用户观察到的成功与真实状态一致。

取舍：采用方案 B。

**As Built**

- `rewind_thread_from_message` 只有在 `commit_codex_rewind_for_workspace(...)` 成功后才返回 `truncated: true`。
- 如果本地提交失败，会主动 archive 刚 fork 出来的 child thread 并返回错误，避免留下“看起来成功”的半成品状态。

### Decision 3: reopen / history load / send 必须共享同一截断后基线（采用）

- 方案 A：各链路分别做局部兼容。
  - 问题：容易出现链路间不一致。
- 方案 B：统一以截断后事实源为基线，禁止读取锚点后数据。
  - 结果：生命周期语义一致，可回归验证。

取舍：采用方案 B。

**As Built**

- rewind 成功后会断开并重连 workspace session，再 `resume` 新 thread，保证运行时基线切换到 child thread。
- Codex history loader 在本地截断历史与 remote resume 结果冲突时，优先采用本地截断后的消息事实。
- 前端 `renameThreadId + hideThread` 后，用户后续发送会落到新的 child thread 上，不再引用旧 thread 作为续写基线。

## Risks / Trade-offs

- [Risk] 历史会话锚点识别异常导致截断失败  
  → Mitigation：返回可恢复错误，不允许降级为 UI-only 成功。

- [Risk] 旧链路缓存导致短时显示旧尾部  
  → Mitigation：rewind 成功后强制断开/重连 session，并以截断后数据刷新当前线程状态。

- [Trade-off] 为语义正确性牺牲了“保留尾部用于调试”的便利  
  → Mitigation：通过日志保留操作诊断，不保留可被业务链路读取的尾部事实。

## Implemented Shape

1. `src/services/tauri.ts` 暴露 `rewindCodexThread(...)`，前端提交 `messageId + targetUserTurnIndex + messageText/occurrence/count` 辅助锚点信息。
2. `src/features/threads/hooks/useThreadActions.ts` 在 Codex rewind 时先恢复 workspace 文件，再调用 hard rewind API。
3. `src-tauri/src/codex/rewind.rs` 负责 `resume -> resolve target -> fork -> hard commit -> archive old thread -> reconnect/resume child thread`。
4. `src-tauri/src/local_usage/codex_rewind.rs` 负责本地 session jsonl 的物理截断、session id 改写、源文件删除与路径安全处理。
5. `src/features/threads/loaders/historyLoaders.test.ts` 对应的 loader 行为保证 UI 历史优先读取本地截断后的真实事实。

## Verification Notes

- 已有：
  - Rust tests 覆盖本地硬截断提交、边界解析、镜像 user message 去重、跨平台安全文件名。
  - 前端 tests 覆盖 hard rewind API 调用、线程切换、resume 不再套 hidden-item filtering。
  - history loader tests 覆盖 remote tail 仍存在时优先采用本地截断真值。
  - Rust reopen regression 覆盖 persisted target session 再加载时仍只读到截断后事实。
  - 前端 messaging regression 覆盖 rewind 后 follow-up send 继续绑定 child thread。

## Rollback Plan

- 发现严重问题时可临时禁用 Codex rewind 入口。
- 不回滚到 UI-only 语义，以避免再次出现“视觉成功、事实失败”。
