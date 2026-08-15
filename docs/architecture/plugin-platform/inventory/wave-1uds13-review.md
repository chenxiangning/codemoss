# Wave 1UDS13 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-uds-connect-deadline`  
> 论文对齐：handshake 是发射；connect 卡住等于发射未完成。  
> 结论：**方向正确。这是实洞。** `connect_uds` / `connect_uds_timed` 现在非阻塞 + poll。listener 不 accept / backlog 满会在 deadline 内 fail closed。UDS / Worker handshake 走 timed connect。成功后恢复阻塞 fd。不切产品。
