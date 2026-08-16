# Design

daemon hydrate 复用 3U 已落地的 `EngineManager::hydrate_claude_history_image`。daemon 仍负责把 JSON locator 反序列化。fork / delete 留给后续刀。
