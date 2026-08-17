# Design

```text
mossx.process.wait
  try_wait supervised CLI
  { exited: false } | { exited: true, code: i32 }

send_message EOF
  flag off → child.wait()
  flag on + grace → interrupt
  flag on + 自然结束 → try_wait → 非零当失败
  flag on + 仍活着 → interrupt（用户停 / 句柄丢失）
```

`/bin/false` 必须能读到非零。`/bin/true` 必须 `code == 0`。
