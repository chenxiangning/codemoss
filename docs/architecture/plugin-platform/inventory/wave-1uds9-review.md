# Wave 1UDS9 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-uds-per-plugin-dir`  
> 论文对齐：isolation = 独立上下文；Notes 与 Claude 不得共享 socket 目录。  
> 结论：**方向正确。这是实洞。** 私有 UDS 目录现在按 pluginId 隔离。非法 pluginId 不得建目录。UDS / Worker / MXPD 都走当前 plugin 目录。不切产品。
