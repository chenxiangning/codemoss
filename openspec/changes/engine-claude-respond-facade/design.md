# Design

复用 3L 的 `get_claude_session_if_present` / `claude_sessions_for_workspace`。只改 Codex / daemon respond 调用点。askuser MCP 仍握 `ClaudeSessionManager`，下一刀再切。
