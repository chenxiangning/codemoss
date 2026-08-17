# Design

```text
build_command()
  → spawn_plan_from_command(program, args, cwd)
      非法 → None
      合法 → SuperviseTarget { executable, argv, cwd }
  → decide_claude_spawn_owner(flag, plan)
      flag off          → CoreCommand          → cmd.spawn()
      flag on + plan    → ProcessEntryNotCutover → 错误，不 spawn
      flag on + None    → Denied               → 错误，不 spawn
```

`MOSSX_CLAUDE_PROCESS_ENTRY` 与 `MOSSX_CLAUDE_COMPAT_FACADE` 独立。后者只切调用面；前者是进程所有权闸门。stream 未切之前，flag-on 只允许 fail closed，禁止双 owner 各拉一个 CLI。

cwd 必须绝对路径且不含 `..`。argv 原样传递，Process Entry 不做 shell 拼接。
