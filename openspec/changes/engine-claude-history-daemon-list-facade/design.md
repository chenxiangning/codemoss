# Design

daemon list 复用 3S 已落地的 `EngineManager::list_claude_history_sessions`。不再在 daemon 里读 config 后直调 `claude_history::*`。load / fork / delete 留给后续刀。
