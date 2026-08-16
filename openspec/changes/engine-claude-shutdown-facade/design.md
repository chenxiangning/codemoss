# Design

门面只转调 Core `list_sessions` / `interrupt_all`。`EngineManager` 增加对称入口。产品退出与 diagnostics list 改走入口。flag off 时行为不变。askuser MCP 与 shared session 留到下一刀。
