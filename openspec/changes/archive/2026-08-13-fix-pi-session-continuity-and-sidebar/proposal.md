# fix-pi-session-continuity-and-sidebar

> **Status**: implemented / user accepted（2026-08-13）  
> **收口**：主 specs 已同步 `pi-thread-session-continuity`、`pi-session-history`；用户确认 native Pi CLI 续聊与历史侧栏可用。

## Why

`add-pi-engine` 只接了 `pi --print` 直播与后端 `list_pi_sessions`，没有把 Kimi/Grok 同款的 **续聊 session id** 和 **侧栏磁盘列表** 接到前端。结果是：同一条 Pi 对话每发一轮就新建一份 jsonl；磁盘上已有的 Pi 历史在左侧完全看不见。这不是 Pi 交互式 `/model` 的特性，是 mossx 接入漏接。

## 目标与边界

- **目标 1**：已绑定 `pi:<sessionId>` 的线程再发送时，必须带 `--session-id` 续同一份 jsonl。
- **目标 2**：`pi-pending-*` 在首轮拿到 native id 后，后续发送必须能续上，而不是再开一份。
- **目标 3**：侧栏必须 merge `list_pi_sessions`，当前 workspace 磁盘上的 Pi 历史可见、可点开、可加载 transcript。
- **边界**：只修 Native Pi。不改 Shared Session、不改 Pi RPC、不合并用户已经拆开的旧 jsonl。

## 非目标

- 不把 Pi 加入 Shared Session。
- 不把多份已拆开的历史 jsonl 自动拼回一条。
- 不改 `pi --print` 协议本身，不升级到 `pi --mode rpc`。
- 不改 Gemini/Kimi/Grok 既有 list/continue 契约。

## What Changes

- 前端 `realSessionId` 补 `pi:` / `pi-pending-` 分支，`continueSession` 对已绑定 Pi session 为 true。
- 增加 `piSessionIdByPendingThreadRef`，首轮 send 后用响应或 `listPiSessions` 回填。
- 侧栏 `listThreads` 同步/异步 merge `listPiSessions`（`includeEngineDiskLists` 路径）。
- Session Index 增加 `sync_pi_engine` / `rows_from_pi_summaries`：生产冷启动侧栏读 Index，这是历史可见的主路径。
- `pi:` 线程 resume 走 `loadPiSession` + Pi history parser，禁止掉进 Codex resume。
- 补 focused Vitest，钉死续聊 payload 与侧栏 merge。

## Capabilities

### New Capabilities

- `pi-thread-session-continuity`: Native Pi 线程与 `~/.pi/agent/sessions` jsonl 的一对一续聊契约。

### Modified Capabilities

- `pi-session-history`: 侧栏必须展示当前 workspace 的磁盘 Pi 会话，点开必须加载 transcript。

## 技术方案对比

| 方案 | 做法 | 取舍 |
|---|---|---|
| A. 对齐 Kimi/Grok 续聊 + 侧栏 merge | 复用 `mergeNativeCliSessionSummaries`，补 Pi 分支 | 改动面小，与现有 CLI 一致。**采用** |
| B. 改走 `pi --mode rpc` 长连接 | 一次进程多轮 | 正确但超出本次止血范围，且 add-pi-engine 明确非目标 |

## 验收标准

- 同一 `pi:` 线程连发两轮，磁盘仍是 **1 个** jsonl，第二轮命令带 `--session-id`。
- 重启后左侧能看到该 workspace 下 `~/.pi/agent/sessions` 的历史 Pi 会话。
- 点开历史能看到 user/assistant/reasoning/tool 行。
- 在已有 Pi 会话里切模型再发送，仍续同一 session 文件（只追加 `model_change`）。
- Kimi/Grok 侧栏与续聊测试不回退。

## 验收记录

- 2026-08-13 用户手测：**native Pi CLI 过了**（同一会话续聊不再拆文件；历史出现在左侧并可打开）。
- 残留（非本变更阻塞）：侧栏删除 `pi:` 仍会落到 Codex delete；已拆开的旧 jsonl 不自动合并。

## Impact

- 前端：`useThreadMessaging.ts`、`useThreadMessagingThreadResolution.ts`、`useThreadActionsListThreadsForWorkspace.ts`、`useThreadActions.helpers.ts`、`useThreadActionsResumeThread.ts`、`sessionIndexThreadSummaries.ts` 及对应测试 mock。
- 后端：`session_index/commands.rs`、`session_index/writers.rs`。不改 `pi.rs` 协议；`--session-id` 路径已存在。
- 数据：只读 `~/.pi/agent/sessions`，不改写用户 auth。
