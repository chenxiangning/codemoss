# Wave 1UDS3 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-uds-private-dir`  
> 论文对齐：transport 是获取；世界可写目录不是允许的获取点。  
> 结论：**方向正确。这是实洞。** `bind_uds("/tmp/...")` 现在 `permission-denied`。socket 落在 `/tmp/m{pid}`（0700）里，自身仍 0600。driver / MXPD 已改走私有目录。不切产品。
