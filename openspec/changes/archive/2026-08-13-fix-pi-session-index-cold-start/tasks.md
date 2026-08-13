# fix-pi-session-index-cold-start tasks

## 1. Session Index gate + fingerprint

- [x] 1.1 `store.rs` 增加 `engine_source_needs_incremental_sync`（missing / fingerprint mismatch / `last_sync_ms==0`，不看 age）
- [x] 1.2 `writers.rs`：`pi_home_fingerprint` 纳入 `sessions/<cwd>/` 子目录 mtime；补单元测试
- [x] 1.3 `commands.rs`：first-paint 非空 Index 立刻返回 SQLite，不阻塞 PI/Gemini/Grok 磁盘扫描；force / 空库才跑 writer
- [x] 1.4 `sync_session_index_core` 对 Gemini / Grok / PI `tokio::join!`

## 2. Live invalidate + first-paint fallback

- [x] 2.1 `useThreadMessaging.ts`：PI pending cache 成功后 fire-and-forget `invalidateSessionIndexForWorkspace`
- [x] 2.2 `useThreadActionsListThreadsForWorkspace.ts`：first-paint 且 Index 无 `engine=pi` 时允许异步 `listPiSessions` merge

## 3. Tests + verify

- [x] 3.1 Rust：fingerprint 在 cwd 子目录新 jsonl 后变化；incremental sync helper 覆盖 missing / match / invalidated
- [x] 3.2 Vitest：PI cache 后调用 invalidate；first-paint 零 PI 行会 merge `listPiSessions`
- [x] 3.3 `openspec validate --change fix-pi-session-index-cold-start --strict --no-interactive`
- [x] 3.4 用户 2026-08-13 重启手测通过：`干啥腻` / `1+1+1` / `2+2` 出现在 ai-reach 侧栏
