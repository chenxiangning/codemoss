# Design

```text
build_command → SpawnPlan
decide owner
  off            → Command::spawn → CoreChild
  on + plan + PE → Host.activate(claude-cli) + supervise(plan) → ProcessEntry
  on + 缺 PE/plan → Denied
```

`ClaudeTurnHandle::ProcessEntry` 持有 `Host<RestrictedProcessDriver>` + generation。stdin 走已有 MXPC。interrupt 走 `Host::interrupt` 杀组。

`send_message` 在拿到 Process Entry 句柄后 **不得** 再 `child.stdout.take()`——没有 Core Child。本刀因此：flag-on 成功 spawn 后，若行源仍不是 cursor，MUST 立刻 interrupt 并返回 `process-entry-lines-not-cutover`。这样不会留下孤儿 CLI，也不会假装切了读循环。
