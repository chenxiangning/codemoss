# Wave 1UDS12 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-uds-unlink-on-timeout`  
> 论文对齐：unload = LIFO inverse；任何失败的发射都必须卸载 socket。  
> 结论：**方向正确。这是实洞。** UDS / Worker handshake 现在用 `UnlinkOnDrop`。connect / write / 2s 读超时走 `?` 也会删 socket。沉默对端后文件不存在。不切产品。
