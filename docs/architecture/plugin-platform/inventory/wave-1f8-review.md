# Wave 1F8 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-process-windows-handles`  
> 论文对齐：隔离 = 独立上下文；未授权句柄不得进入子进程。  
> 结论：**方向正确。这是实洞。** Windows spawn 必须先过 `CREATE_NO_WINDOW` 且不得额外 inherit。缺 flag / 请求 inherit 不得留下 child。本机 macOS 验收政策闸门；完整 CreateProcess 只在 Windows 上跑。不切产品。
