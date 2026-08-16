# Design

整会话 fork 仍是磁盘 JSONL 克隆。门面增加 `fork_history_session`。`EngineManager::fork_claude_history_session` 读 Claude config 后经 `claude_owner()`：flag on 走门面，flag off 直调同一份实现。GUI command 仍负责包 thread JSON。`from_message` 留给下一刀。
