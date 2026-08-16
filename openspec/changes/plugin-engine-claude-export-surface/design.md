# Design

`runtime` 再导出现有 Claude 前端 helper：managed model、resume command、history loader、fork、context window、custom models。AppShell / 会话 / 设置改走该包。同族 history parser 与 Rust `engine/claude*` 不搬家。
