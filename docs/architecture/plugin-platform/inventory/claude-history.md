# Claude History Inventory（Wave 3R）

> pluginId：`com.mossx.engine.claude`  
> 状态：**inventory-only**。本刀不改实现、不接门面、不删代码。

## 它是什么

磁盘 JSONL，不是 `ClaudeSessionManager` 内存表。runtime session 已走 `claude_owner()`；history 仍直调 `claude_history::*`。

## 产品调用面

| 面 | 落点 |
|---|---|
| GUI command | `session_history_commands.rs` list/load/hydrate/fork/delete |
| Rewind | `rewind_commands.rs` fork from message |
| daemon | `daemon_state.rs` 同名 RPC |
| Session catalog | `session_management.rs` + catalog projection/helpers |
| Native continuation | `native_continuation/commands.rs` resolve file |
| Frontend | `src/services/tauri/session.ts` + `claudeHistoryLoader.ts` |

## 必须留下的 Core

history command 壳、session catalog 调度、其他 CLI 的 history parser。Gemini / Grok / Kimi frontend parser 复用了 `parseClaudeHistoryMessages`，不能跟 Claude 一起搬走。

## 禁止

从 3R 跳到删 `claude_history*`、迁 `note_cards`、开 Marketplace、默认开 flag。
