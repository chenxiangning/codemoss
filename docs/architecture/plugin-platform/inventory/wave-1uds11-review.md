# Wave 1UDS11 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-uds-unlink-on-failure`  
> 论文对齐：unload = LIFO inverse；失败的发射必须卸载 socket。  
> 结论：**方向正确。这是实洞。** UDS handshake 无论成功或失败都会 unlink socket。错 nonce 后文件不存在。Worker 原本已 unlink。不切产品。
