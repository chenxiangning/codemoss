# Tasks: rewrite-sidebar-session-index

## 1. Backend Session Index

- [x] 1.1 SQLite store + upsert/list by workspace_path
- [x] 1.2 Claude writer（project dir mtime + history.jsonl titles）
- [x] 1.3 Codex writer（ThreadPreview + index titles）
- [x] 1.4 Kimi writer（session_index.jsonl）
- [x] 1.5 IPC `list_session_index_for_workspace` / `sync_session_index_for_workspace`
- [x] 1.6 Codex recent-first date-partition candidate collect（ThreadPreview）
- [x] 1.7 Gemini / Grok writers（async list + 3s timeout + upsert）
- [x] 1.8 OpenCode writer（2s timeout，soft-empty，不拖垮 index sync）
- [x] 1.9 `invalidate_session_index_for_workspace` + fingerprint 窗口 8s

## 2. Frontend

- [x] 2.1 tauri sessionIndex client
- [x] 2.2 first-paint merge Session Index rows
- [x] 2.3 取消 exhaustive auto full-catalog；quiet index soft re-sync
- [x] 2.4 unit tests helpers + hydration contract update
- [x] 2.5 soft re-sync 走 preserveState + forceSync index

## 3. Specs / docs

- [x] 3.1 OpenSpec proposal/design/tasks
- [x] 3.2 capability delta `sidebar-session-index`
- [x] 3.3 更新 `dev-guidelines/guides/workspace-session-catalog-contract.md`
- [ ] 3.4 人工冷启验收（本机 2.6GB Codex corpus）

## 4. Still open

- [ ] 4.1 真·fs watch（notify）实时失效 source fingerprint
- [ ] 4.2 Session 管理页首屏改 index + 显式 full catalog 次屏
