# Design

history 是磁盘 JSONL，不是 runtime session 表。门面增加 `list_history_sessions`。`EngineManager::list_claude_history_sessions` 读 Claude config 后经 `claude_owner()`：flag on 走门面，flag off 直调同一份 `list_claude_sessions_with_config`。GUI command 只调 manager 入口。
