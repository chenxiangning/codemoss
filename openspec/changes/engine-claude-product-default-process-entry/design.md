# Design

```text
未设 / 1 / true / yes  → Process Entry
0 / false / off        → CoreCommand + Tokio
flag on + 无 plan      → Denied
boot_driver()          → 仍 missing_executable()
```

`cmd.spawn()` 源码保留作显式关闭回退，不是默认路径。
