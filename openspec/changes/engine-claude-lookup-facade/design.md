# Design

门面只转调 Core lookup / remove_runtime。`EngineManager` 增加 `get_claude_session_if_present`、`claude_sessions_for_workspace`、`claude_runtime_sessions_for_workspace`、`remove_claude_runtime_session`。`state.rs` 换 bin 改用已有 `list_claude_sessions`。askuser / Codex control 留到下一刀。
