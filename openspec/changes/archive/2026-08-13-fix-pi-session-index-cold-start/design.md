# fix-pi-session-index-cold-start design

## Context

`fix-pi-session-continuity-and-sidebar` 已接上：

- Native 续聊 `--session-id`
- `sync_pi_engine` / `rows_from_pi_summaries`
- 前端 `mergePiSessionSummaries`（仅 `includeEngineDiskLists`）

`rewrite-sidebar-session-index` 随后把生产冷路径改成 Index-first，并规定：

- first-paint **禁止** 自动 full-catalog
- `list_session_index_for_workspace` 仅在 workspace Index **为空** 或 `forceSync` 时跑 writers

结果：ai-reach 这类早已有 Claude/Kimi 行的 workspace，冷启动永远不跑 `sync_pi_engine`。直播 remap 只写内存，重启即丢。

另两处放大：

1. `pi_home_fingerprint()` 只 hash `~/.pi/agent` 与 `sessions/` 父目录 mtime。PI jsonl 写在 `sessions/<encoded-cwd>/`，父目录 mtime 不变。
2. `sync_session_index_core` 串行 Gemini → Grok → PI。post-first-paint `forceSessionIndexSync` 前端只等 6s，PI 经常还没开始。

## Goals / Non-Goals

**Goals:**

- Index list 按 **engine source stale** 触发 writer
- 新 PI jsonl 能通过 fingerprint 被发现
- force / 冷启动 sync 不因串行超时丢掉 PI
- live 拿到 native id 后 Index 必须失效，下次 list 会扫
- first-paint 零 PI 行时有有界磁盘补扫

**Non-Goals:**

- 不打开全引擎 disk list
- 不改 PI CLI 协议 / Shared
- 不重写 Claude/Codex/Kimi light index

## Decisions

### D1. 冷启动 list 必须先读 warm SQLite，禁止挡住 PI 投影

first-paint 只有 2.5s。`list_pi_sessions` 扫 jsonl 很容易超时。超时后前端丢掉 Index，侧栏只剩不含 PI 的 last-good——这就是「重启后看不到 native PI」的显示失败。

因此 `list_session_index_for_workspace(syncIfNeeded)`：

- Index **非空** 且非 force：立刻返回 SQLite 行（毫秒级），**不**等待 PI/Gemini/Grok writer
- Index **为空** 或 `forceSync`：才跑 writer（Gemini/Grok/PI 并行）

per-engine stale 只用于 force / 空库。live invalidate + post-first-paint `forceSessionIndexSync` 负责把新 jsonl 写进 Index。

Visibility 未 verified 时，仍要把 Index 里的 `engine=pi` 行投影进侧栏，不能整包退回 last-good。

### D2. PI fingerprint 纳入 cwd 子目录

`pi_home_fingerprint()` 追加 `sessions/` 下一层目录的 `name:mtime:len`，排序后拼接。新 jsonl 更新 cwd 目录 mtime，fingerprint 变化。

不解析 jsonl、不按 workspace 过滤——fingerprint 只回答「PI 家目录有没有变」。workspace 过滤仍在 `list_pi_sessions`。

### D3. Gemini / Grok / PI 并行

`sync_session_index_core` 在 disk engines 之后：

```text
tokio::join!(sync_gemini_engine, sync_grok_engine, sync_pi_engine)
```

OpenCode 仍单独（要 `AppState`，且 2s soft timeout）。PI 不再排在 6s 预算末尾。

### D4. Live remap 后 invalidate，不在 send 路径同步 sync

`useThreadMessaging` 在 `piSessionIdByPendingThreadRef.set` 成功后 fire-and-forget `invalidateSessionIndexForWorkspace`。`last_sync_ms = 0` 让 D1 gate 在下次 list/重启时必跑 PI writer。

不在 send 热路径 `await sync_session_index`——避免拖 turn。

### D5. first-paint 零 PI 行才补 `listPiSessions`

不恢复全引擎 `includeEngineDiskLists`。仅当：

- `startupHydrationMode === "first-paint"`
- 且本次 Index page 没有任何 `engine === "pi"` 行

才走现有异步 `listPiSessions` merge。Index 已有 PI 时保持 Index-first。

## Risks / Trade-offs

- [Risk] 每次 list 都算 PI fingerprint（读若干 cwd 目录 metadata）→ 目录数通常个位数，远小于 jsonl walk。
- [Risk] invalidate 过宽会让 Gemini/Grok 也重扫 → 可接受；比丢 PI 轻。后续若要可加 engine-scoped invalidate。
- [Risk] first-paint PI 补扫与 live remap 竞态 → 已有 `mergeNativeCliSessionSummaries` 按 id 去重。
- [Risk] 与 `rewrite-sidebar-session-index` 重叠 → 本变更不恢复 auto full-catalog，只修 Index writer 闸门。

## Migration Plan

- 无 schema 迁移。下一次 `list_session_index` 用新 fingerprint，旧 source 行 mismatch 后自动重扫。
- 回滚：还原 list gate / fingerprint / join / invalidate / first-paint 补扫五处即可。
