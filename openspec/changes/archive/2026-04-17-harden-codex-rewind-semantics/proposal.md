## Why

这个 change 最初用于修正 Codex rewind 的旧语义问题：UI 看起来回退了，但事实层没有真正截断。  
当前代码已经完成核心实现，因此这里回写为“已实现状态”，避免提案继续停留在未来时。

已落地的关键变化：

- 后端新增 `rewind_codex_thread` 专用链路，不再把 `fork_thread` 当成 rewind 成功的全部语义。
- `commit_codex_rewind_for_workspace` 会按锚点前内容重写新的 Codex session 文件、改写 session id，并删除旧 session 文件。
- rewind 成功后会断开并重连 workspace session，再 `resume` 新 child thread，确保运行时会话也切到截断后事实。
- Codex history loader 已优先采用本地截断后的真实历史，不再依赖 persisted hidden filter 保证正确性。

## 目标与边界

### 目标

- Codex rewind 成功后，目标锚点之后的会话事实在运行时会话与磁盘会话文件都不可再读取。
- rewind 成功语义收敛为：`success == hard truncation committed`。
- 回退后 reopen / history load / send 统一基于截断后事实，不再依赖 UI 隐藏层保证正确性。
- 在“回退是否真实生效”这一点上与 Claude 保持一致。

### 边界

- 仅改 Codex rewind 执行语义，不扩展其它线程生命周期功能。
- 不改 rewind UI 入口与视觉交互。
- 不引入“软删除可恢复”或历史归档新能力。

## 非目标

- 不处理 rewind 之外的线程排序、筛选、搜索。
- 不新增产品层功能，仅修正回退语义。
- 不改动 Claude 的既有回溯实现，仅让 Codex 对齐。

## What Changed

### 1) Codex 硬回溯提交链路已落地

- 已实现 `rewind_codex_thread` 后端命令，调用链为：
  - `resume_thread_core` 读取当前 thread 用户消息序列。
  - `resolve_target_message_id` 基于 `messageId / targetUserTurnIndex / targetUserMessageText / occurrence` 解析稳定锚点。
  - `fork_thread_core` 先生成 child thread。
  - `commit_codex_rewind_for_workspace` 对本地 session jsonl 做硬截断提交。
  - 原 thread 进入 archive，rewind 响应返回 `truncated: true`、`deletedCount`、`resolvedMessageId`。
- 本地提交语义已包含：
  - 新会话文件仅保留锚点前内容。
  - `session_meta / turn_context / payload.sessionId` 等标识统一重写到 child session。
  - 旧会话文件物理删除，避免尾部继续作为事实源。
- 锚点规则已落地为：`messageId` 优先；无法稳定匹配时按 user-turn index 与本地 user-count 做确定性回退；失败返回可恢复错误。

### 2) 前端正确性已切换到后端提交结果

- 前端已改为调用 `rewindCodexThread(...)`，不再把 hidden-map 当作事实正确性的主机制。
- rewind 成功后，线程 id 会切换到新的 child thread，并隐藏旧 thread，后续交互都基于新 thread。
- `resumeThreadForWorkspace` 已验证不会再对 Codex 线程应用 persisted hidden-item filtering。

### 3) 生命周期链路已读取截断后真值

- rewind 后的 resume / reopen 历史读取已统一偏向截断后的本地真值。
- 当 remote `resume` 仍带着旧尾部时，Codex history loader 会优先采用本地截断后的消息历史，避免把已回退尾部重新拼回 UI。
- send 路径会跟随重命名后的新 thread id 继续工作，因此不会再以旧 thread 作为上下文事实源。

## 技术方案

### 方案 A：继续 UI hidden 裁剪

- 优点：改动小。
- 缺点：事实层未截断；重启、fallback、后续发送容易复现尾部。

### 方案 B：事实层硬截断（已实现）

- 做法：把成功判定下沉到后端硬提交；前端只渲染提交后事实。
- 优点：语义可验证、重启可验证、可与 Claude 对齐。
- 成本：需要补齐后端截断逻辑与回归测试矩阵。

取舍：采用方案 B。该问题属于会话真值问题，必须在数据层解决。

## Capabilities

### New Capabilities

- `codex-rewind-hard-truncation`：Codex rewind 的真实截断语义（内存 + 磁盘）与回退后一致性约束。

## Impact

- Frontend
  - `src/features/threads/hooks/useThreadActions.ts`
  - `src/features/threads/loaders/codexHistoryLoader.ts`
  - `src/services/tauri.ts`
  - `src/features/threads/hooks/useThreadActions.codex-rewind.test.tsx`
  - `src/features/threads/loaders/historyLoaders.test.ts`
- Backend
  - `src-tauri/src/codex/rewind.rs`
  - `src-tauri/src/codex/mod.rs`
  - `src-tauri/src/local_usage.rs`
  - `src-tauri/src/local_usage/codex_rewind.rs`
  - `src-tauri/src/local_usage/tests.rs`
- Tests
  - 已覆盖：硬截断文件提交、messageId/index 锚点解析、镜像 user message 去重、cross-platform 文件名安全
  - 已覆盖：前端调用 `rewind_codex_thread`、rewind 后 thread 切换、resume 不再应用 hidden-item filtering
  - 已覆盖：history loader 优先本地截断真值，即使 remote resume 仍含回退尾部
  - 已覆盖：persisted reopen 语义回归、rewind 后 child thread follow-up send 回归

## 验收标准

- 对任意 Codex 会话执行 rewind 成功后，目标锚点之后事实在运行时与磁盘会话文件均不可读取。
- rewind 返回 success 之前，硬截断提交必须已完成；不得出现“UI 成功但事实未截断”。
- 应用重启后 reopen 同一会话，不得出现被回退尾部。
- 回退后首次 send 必须只基于截断后上下文。
- Claude 既有行为保持不变；Codex 在“回退是否真实生效”语义上与 Claude 一致。

## 实现证据

- 后端硬截断提交：`src-tauri/src/codex/rewind.rs` + `src-tauri/src/local_usage/codex_rewind.rs`
- 本地截断测试：`src-tauri/src/local_usage/tests.rs`
- 前端切换到 hard rewind API：`src/services/tauri.ts` + `src/features/threads/hooks/useThreadActions.ts`
- hidden filter 退出正确性链路：`src/features/threads/hooks/useThreadActions.codex-rewind.test.tsx`
- 历史读取优先本地截断真值：`src/features/threads/loaders/historyLoaders.test.ts`
