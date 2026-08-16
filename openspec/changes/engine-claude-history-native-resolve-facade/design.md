# Design

resolve 保持同步。门面只换调用路径，不读 JSONL 内容。`EngineManager` 读 Claude config 后经 `claude_owner()`。两处调用共用同一入口。
