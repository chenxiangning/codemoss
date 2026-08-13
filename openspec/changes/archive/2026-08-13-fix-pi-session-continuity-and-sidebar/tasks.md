# fix-pi-session-continuity-and-sidebar tasks

## 1. Continuity

- [x] 1.1 `useThreadMessagingThreadResolution.ts` 增加 `piSessionIdByPendingThreadRef` 并导出
- [x] 1.2 `useThreadMessaging.ts` 的 `realSessionId` 补 `pi:` / `pi-pending-`；send 后回填 pending cache
- [x] 1.3 接线处把 ref 传入 messaging hook（与 Kimi 相同的 hook 装配点）

## 2. Sidebar + resume

- [x] 2.1 `normalizePiSessionSummaries` + `mergePiSessionSummaries`
- [x] 2.2 `listThreads` 增加 Pi signal / cache / 同步 merge / 异步 refresh
- [x] 2.3 `normalizeCatalogEngine` 识别 `pi`
- [x] 2.4 `useThreadActionsResumeThread` 为 `pi:` 走 `loadPiSession`

## 3. Tests + verify

- [x] 3.1 Vitest：`pi:` follow-up 发送 `continueSession=true` + 正确 sessionId
- [x] 3.2 Vitest：`mergePiSessionSummaries` 把磁盘会话并入侧栏且不重复 live 行
- [x] 3.3 测试 mock 补 `listPiSessions`；跑 focused messaging / helpers / list 测试
- [x] 3.4 `openspec validate --change fix-pi-session-continuity-and-sidebar --strict`

## 4. 不提交

- [x] 4.1 不 `git commit`；交给用户手测
