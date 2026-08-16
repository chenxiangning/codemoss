# Design

门面增加 `set_config`。`set_engine_config(Claude)` flag on 时经门面。`claude_manager` 改为 crate-private。manager 单测用 `get_claude_session_if_present` 验共享，不再摸字段。产品模块源码断言无 `.claude_manager`。
