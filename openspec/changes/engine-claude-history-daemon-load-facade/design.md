# Design

daemon load 复用 3T 已落地的 `EngineManager::load_claude_history_session`，limit / before 传 `None`，等价于原来的 `load_claude_session_with_config`。hydrate / fork / delete 留给后续刀。
