# Wave 1NP6 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-named-pipe-plugin-name`  
> 论文对齐：隔离 = 独立上下文；同后缀插件不得共享发射点。  
> 结论：**方向正确。这是实洞。** `private_pipe_name` 用完整 pluginId 的 FNV-1a token 派生 `\\.\pipe\mossx-{token}`。默认 `mossx-host` 会解析成插件私有管名。`com.mossx.notes` 与 `com.evil.notes` 不同。macOS 只验命名闸门。不切产品。
