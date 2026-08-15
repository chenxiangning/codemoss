# Wave 1UDS2 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-uds-mode`  
> 结论：**方向正确。这是实洞。** `bind_uds` 之后 socket 必须 0600，对齐 Named Pipe 当前用户 ACL。不切产品。
