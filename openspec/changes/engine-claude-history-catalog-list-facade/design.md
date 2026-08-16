# Design

catalog list 保留 attribution scopes。门面增加独立入口，不复用 GUI `list_history_sessions`。`EngineManager` 读 Claude config 后经 `claude_owner()`。`session_management.rs` 仍负责 `build_claude_attribution_scopes`。
