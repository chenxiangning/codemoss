# Wave 1F7 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-process-fds`  
> 论文对齐：隔离 = 独立上下文；未授权句柄不得进入子进程。  
> 结论：**方向正确。这是实洞。** Unix spawn 在 `pre_exec` 关闭 `fd >= 3`。peer 扫描到额外 FD 则 exit 5。Host 打开的探测 FD 不得阻断 handshake。本刀不处理 Windows handle inheritance。不切产品。
