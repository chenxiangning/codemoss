# Design

私有 `ClaudeOwner` 枚举：`Facade` / `Core`。`claude_owner()` 按 flag 选一边。`EngineManager` 的 Claude 方法只调 owner。`remove_workspace_sessions` 下沉到 `ClaudeSessionManager`，门面转调。
