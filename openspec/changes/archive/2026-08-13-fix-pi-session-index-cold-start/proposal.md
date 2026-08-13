# fix-pi-session-index-cold-start

> **Status**: implemented / user accepted（2026-08-13）  
> 接续已归档 `fix-pi-session-continuity-and-sidebar`：writer / remap 已在，冷启动投影补齐。

## Why

Native PI 会话只在实时对话内存 remap 时出现在侧栏。重启后消失。根因不是 jsonl 没落盘，而是生产冷启动只读 Session Index，而 Index 在 workspace 已有 Claude/Kimi 行时整段 skip `sync_pi_engine`；PI 指纹只盯 `sessions/` 父目录 mtime，cwd 子目录里的新 jsonl 不会触发 rescan。

本机证据（2026-08-13）：`1+1` 已在 `~/.pi/agent/sessions/--Users-chenxiangning-code-AI-reach-ai-reach--/2026-08-13T14-48-50-284Z_019ffb98-….jsonl`，SQLite 缺该 id；`pi:ai-reach` last_sync 早于该文件 7 秒。

## 目标与边界

- **目标 1**：`list_session_index_for_workspace(syncIfNeeded)` 必须按 **engine stale** 决定是否 sync，禁止「workspace 非空就不跑 PI writer」。
- **目标 2**：PI fingerprint 必须覆盖 `sessions/<cwd>/` 子目录 mtime，新 jsonl 能把 source 标成 stale。
- **目标 3**：Gemini / Grok / PI writer 并行，避免 force sync 6s 超时砍掉排在队尾的 PI。
- **目标 4**：live remap 拿到 `pi:<id>` 后必须 invalidate Index，保证下次冷启动会扫。
- **目标 5**：first-paint Index 若零 PI 行，允许一次有界 `list_pi_sessions` 补扫，不打开 full-catalog。
- **边界**：只修 Native PI 冷启动可见性。不改 `pi --print` 协议，不合并已拆 jsonl，不把 PI 拉进 Shared。

## 非目标

- 不改 Shared Session / `extend-shared-session-cli-targets-pi`。
- 不恢复 first-paint 自动 full-catalog。
- 不改 Claude / Codex / Kimi 的 light-index writer 语义。
- 不把 `includeEngineDiskLists` 默认打开给全部引擎。

## What Changes

- Session Index list gate：`needs_sync` 从 `existing.is_empty()` 改为 per-engine fingerprint / missing-source / invalidated。
- `pi_home_fingerprint` 纳入 `sessions/*` cwd 子目录 mtime。
- `sync_session_index_core` 对 Gemini / Grok / PI `tokio::join!`。
- Native PI send 回填 session id 后调用 `invalidate_session_index_for_workspace`。
- first-paint 在 Index 无 PI 行时异步 merge `listPiSessions`。

## Capabilities

### New Capabilities

- `session-index-engine-stale-sync`: Session Index list/sync 必须按引擎 source stale 触发 writer，不能用「workspace 已有任意行」短路。

### Modified Capabilities

- `pi-session-history`: 冷启动 / 重启后当前 workspace 的磁盘 PI 会话必须出现在侧栏；live remap 必须让 Index 在下次 list 时 rescan。

## 技术方案对比

| 方案 | 做法 | 取舍 |
|---|---|---|
| A. Per-engine stale + cwd fingerprint + 并行 writer + live invalidate | 冷路径仍 Index-first，只补 PI 漏接 | 改动面小，不破坏 rewrite-sidebar-session-index。**采用** |
| B. first-paint 重新打开全引擎 `includeEngineDiskLists` | 每次冷启动扫 Gemini/Grok/PI 磁盘 | 与 Index-first 冲突，拖慢 first-paint。拒绝 |
| C. 仅前端 last-good 持久化 live PI | 重启靠 snapshot | Index 仍缺行，点开/load-older/别的 workspace 仍丢。拒绝 |

## 验收标准

- 在已有 Claude/Kimi 历史的 workspace 新建一条 Native PI `1+1`，重启后侧栏仍有 `pi:<sessionId>`，标题来自首条 user prompt。
- 同一 cwd 子目录再写一份 jsonl（父 `sessions/` mtime 不变）后，下次 `syncIfNeeded` 必须跑 `sync_pi_engine` 并 upsert 新行。
- first-paint 不启动 exhaustive `list_workspace_sessions` / full-catalog。
- Kimi / Grok / Claude 既有侧栏测试不回退。

## Impact

- 后端：`src-tauri/src/session_index/commands.rs`、`writers.rs`、`store.rs`
- 前端：`useThreadMessaging.ts`、`useThreadActionsListThreadsForWorkspace.ts`
- 规范：`pi-session-history`、新 `session-index-engine-stale-sync`
- 数据：只读 `~/.pi/agent/sessions`，不改写用户 auth / jsonl 内容
