# fix-pi-session-continuity-and-sidebar design

## Context

`add-pi-engine` 已实现：

- `pi --print --mode json [--session-id] [--model]`
- `list_pi_sessions` / `load_pi_session`
- live remap：`SessionStarted` → `current_thread_id = pi:{id}`

缺口在前端契约，和 Kimi 对比：

| 环节 | Kimi | Pi（现状） |
|---|---|---|
| `realSessionId` | `kimi:` slice + pending ref | 掉到 `null` |
| `continueSession` | `realSessionId !== null` | 永远 false |
| pending cache | `kimiSessionIdByPendingThreadRef` | 无 |
| 侧栏 merge | `listKimiSessions` + `mergeKimiSessionSummaries` | `listPiSessions` 未调用 |
| resume | `loadKimiSession` | 掉进 Codex `resumeThread` |

磁盘证据：ai-reach 下 4 份单轮 jsonl，无 `parentSession`。交互式 Pi `/model` 会在同一文件追加 `model_change`（mossx 工作区 8/10 会话已证明）。

## Goals / Non-Goals

**Goals**

- finalized `pi:` 与 pending 续聊都传 `--session-id`
- 侧栏可见当前 workspace 的磁盘 Pi 历史
- 点开走 Pi history，不走 Codex

**Non-Goals**

- 合并已经拆开的旧文件
- Shared / RPC
- 改 Rust print 协议

## Decisions

### D1. 复用 Kimi 的 native CLI 续聊形状

`realSessionId` 增加：

- `pi:` → `threadId.slice("pi:".length)`
- `pi-pending-` → `piSessionIdByPendingThreadRef.get(threadId)`

首轮 send 后用 `extractSessionIdFromEngineSendResponse`，失败则 `listPiSessions` + 时间窗口 pick（照抄 Kimi）。

不新造 session 存储。Pi 的 identity 已经是 jsonl header `id`。

### D2. 侧栏走 Session Index + Kimi 同款 disk merge

冷启动侧栏默认读 Session Index，不扫 `list_*`。因此历史可见必须同时：

1. Session Index writer：`sync_pi_engine` + `rows_from_pi_summaries`（对齐 Gemini/Grok）
2. 前端 `sessionIndexRowsToThreadSummaries` 识别 `engine=pi` → `pi:<id>`
3. `listThreads` 在 `includeEngineDiskLists` 时 merge `listPiSessions`（刷新/管理页）

`normalizeCatalogEngine` / `inferThreadEngineSource` / `THREAD_ENGINE_SOURCES` 补 `pi`。

### D3. Resume 独立分支，禁止 Codex fallback

在 `useThreadActionsResumeThread` 的 `kimi:` 分支后插入 `pi:`：`loadPiSession` + `parsePiHistoryMessages`。

### D4. 不回写旧拆分文件

用户已经产生的多份 jsonl 保持原样。修的是从现在起不再拆。

## Risks

- pending 尚未 cache 时连点发送：与 Kimi 一样，第二发可能仍无 id。缓解：send 返回后立刻 cache；SessionStarted remap 后走 `pi:` 分支。
- 侧栏异步 refresh 与 live remap 竞态：`mergeNativeCliSessionSummaries` 按 id 去重，已处理。
- `listPiSessions` 扫描超时：沿用 Kimi timeout，失败不推翻已有 live 行。
