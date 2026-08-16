# Design

delete 仍是磁盘 JSONL 删除。门面增加 `delete_history_session`。`EngineManager::delete_claude_history_session` 读 Claude config 后经 `claude_owner()`：flag on 走门面，flag off 直调同一份实现。GUI command 仍负责 remote 转发。
