# Design

```text
flag off → 现有 cmd.spawn() + Ok(Some(Lines))
flag on  → interrupt 旧 Process Entry
           spawn_process_entry_turn(resume plan)
           写 stdin / close
           insert active_process_entries
           Ok(None) → 循环继续 next_claude_line
```

`Ok(None)` 在产品合同里表示「继续读当前源」。换句柄后再返回它，不是失败。缺 Process Entry 文件仍 fail closed。
