# Wave 1F9 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-runtime-process-memory-limit`  
> 论文对齐：隔离 = 独立上下文；未声明无限预算是未声明依赖，必须 fail closed。  
> 结论：**方向正确。这是实洞，但颗粒度按平台收窄。** `process_memory_limit_ok` 拒绝 0 / 超过 2048 MiB。spawn 必须注入 `MOSSX_PROCESS_MEMORY=512MiB`。Linux `pre_exec` 设 `RLIMIT_AS`；本机 macOS 下调 `RLIMIT_AS`/`DATA` 会 EINVAL，不得把预算改成无限，也不得因此阻断 handshake。peer 看不到声明预算则退出 6。不切产品。
