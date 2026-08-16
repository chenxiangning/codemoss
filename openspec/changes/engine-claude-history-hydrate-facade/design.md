# Design

hydrate 仍是磁盘 JSONL 的延迟读。门面增加 `hydrate_history_image`。`EngineManager::hydrate_claude_history_image` 读 Claude config 后经 `claude_owner()`：flag on 走门面，flag off 直调同一份实现。GUI command 仍负责把 JSON locator 反序列化。
