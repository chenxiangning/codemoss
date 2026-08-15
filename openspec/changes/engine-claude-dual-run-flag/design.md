# Design: engine-claude-dual-run-flag

## Decisions

### D1. 门面包同一份 manager

`ClaudeCompatAdapter::core()` 仍自建 manager，供隔离单测。产品路径只用 `wrapping(engine.claude_manager.clone())`。禁止 flag on 时 `ClaudeSessionManager::new()` 第二份表。

### D2. flag 可读、可注入

`claude_compat_facade_enabled()` 读 `MOSSX_CLAUDE_COMPAT_FACADE`。`EngineManager::new()` 用该函数；测试走 `new_with_claude_compat(bool)`，避免污染进程环境。

### D3. 仍是 Core owner

`CompatOwner` 只有 `CoreClaude`。flag 切的是 **调用路径**，不是第二个实现。

### D4. 只切 Claude session getter

`get_claude_session` 与 `get_claude_session_for_provider`。不改 send/interrupt/history，不改其他 CLI。
