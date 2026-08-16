# Design

daemon fork 复用 3V 已落地的 `EngineManager::fork_claude_history_session`。daemon 仍负责包 thread JSON。`from_message` / delete 留给后续刀。
