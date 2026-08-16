# Design

`ClaudeAskLookup` 是 cloneable 句柄，委托同一份 Core manager。flag on 时从门面取出 manager Arc，flag off 时从 `claude_manager` 取出。MCP `init_global` 改吃该句柄。`state.rs` 经 `EngineManager` 设 sink。测试仍可用 `from_manager` 直接构造。
