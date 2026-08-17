# Design

```text
activate + supervise
  cursor.next_line()
  首行超时 → first-event-timeout + 已采 stderr
  每行 on_line
  同时 drain read-stderr
  EOF → (lines, stderr)
```

这是 `send_message` 读循环的骨架，不是 cutover。产品仍握着 tokio timeout、post-result grace、text-delta coalesce、`active_processes` interrupt。那些下一批再搬。

测试用短 deadline（毫秒级），避免把 90s 产品常量拉进插件测试。
