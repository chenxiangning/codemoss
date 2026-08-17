# Design

```text
flag off → 现有 cmd.spawn() 第二条 Core Child
flag on  → interrupt Process Entry generation
           返回 process-entry-resume-not-cutover
           禁止 cmd.spawn()
```

下一刀才允许 resume 再走 `spawn_process_entry_turn`。本刀只堵双 owner。
