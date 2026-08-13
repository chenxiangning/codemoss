# verification: fix-pi-session-continuity-and-sidebar

## 自动化

- `openspec validate fix-pi-session-continuity-and-sidebar --strict` 通过
- Vitest
  - `continues finalized pi session with native thread id` 通过
  - `mergePiSessionSummaries adds disk sessions without duplicating live rows` 通过
  - `sessionIndexRowToThreadId` Pi 映射通过
  - helpers + sessionIndex + stale-list-abandon + native-session-bridges：59/59
  - shared-native-compat + thread-kind-identity：通过
- `cargo test rows_from_pi_summaries_prefix_engine_and_title --lib` 通过

未作为本变更回归门：`useThreadMessaging.test.tsx` 里 3 条 Shared/Codex 用例（竞态/超时）与 `useThreads.sidebar-cache.test.tsx` 5s timeout 级联。与 Pi payload 无关，未扩大断言失败集到 Pi 新用例。

## 待用户手测（需重新编译，含 Rust Session Index）

1. 重启后打开 `ai-reach`：左侧应出现磁盘上的 Pi 历史（你好 / 你在干什么 / 1+1）。冷启动后可能要等几秒 Index sync。
2. 点开一条历史，应能看到完整 transcript。
3. 在同一条里再发「2+2」：左侧不应再冒出新行；`~/.pi/agent/sessions/...ai-reach...` 仍是同一 jsonl 追加。
4. 切一次模型再发：仍同一文件，只多一行 `model_change`。

## 用户验收

- 2026-08-13 用户确认：**native Pi CLI 过了**。续聊不再拆 session，历史可在左侧看到。

**已回写提案并归档收口。**
