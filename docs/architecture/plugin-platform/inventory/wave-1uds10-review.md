# Wave 1UDS10 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-uds-unique-plugin-token`  
> 论文对齐：isolation = 独立上下文；同后缀的 pluginId 不得共享目录。  
> 结论：**方向正确。这是实洞。** 私有 UDS 目录 token 现在由完整 pluginId 的 FNV-1a 派生。`com.mossx.notes` 与 `com.evil.notes` 不得共享目录。不切产品。
