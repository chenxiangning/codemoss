# Design

history load 仍是磁盘 JSONL。门面增加 `load_history_session`，参数与 GUI command 一致（limit / before）。`EngineManager::load_claude_history_session` 读 Claude config 后经 `claude_owner()`：flag on 走门面，flag off 直调同一份 `load_claude_session_with_config_window`。
