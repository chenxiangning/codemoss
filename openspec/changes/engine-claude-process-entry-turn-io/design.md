# Design

```text
activate(Process Entry + supervise)
  → run_supervised_turn_io(stdin?)
       write? → close-stdin → read until eof
  → interrupt 杀组
```

这是产品 `send_message` 的 IO 骨架，不是产品 cutover。`send_message` 仍握着 tokio `Child` 的行解析、stderr 采样、first-event timeout、post-result grace。那些语义下一批再搬。

flag-on 继续 `process-entry-spawn-not-cutover`。只有 `run_supervised_turn_io` 过真实 echo/cat 后，才允许下一步把 `send_message` 的 stdin/stdout 接到这里。
