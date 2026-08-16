# Design

rewind 仍是磁盘 JSONL 按 message 截断克隆。门面增加 `fork_history_session_from_message`。`EngineManager::fork_claude_history_session_from_message` 读 Claude config 后经 `claude_owner()`：flag on 走门面，flag off 直调同一份实现。GUI command 仍负责 remote 转发和 thread JSON。
