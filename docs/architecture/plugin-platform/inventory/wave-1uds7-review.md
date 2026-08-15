# Wave 1UDS7 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-uds-accept-deadline`  
> 论文对齐：handshake 是发射；无人连接不得一直占着 listener。  
> 结论：**方向正确。这是实洞。** `accept_uds_timed` 用 poll + 非阻塞 accept。无人连接 `handshake-timeout`。UDS / Worker handshake 走 timed accept。测试 socket 名加了序号，避免并行撞路径。不切产品。
