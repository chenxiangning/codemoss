# Design

daemon rewind 复用 3X 已落地的 `EngineManager::fork_claude_history_session_from_message`。daemon 仍负责包 thread JSON。delete / catalog 留给后续刀。
