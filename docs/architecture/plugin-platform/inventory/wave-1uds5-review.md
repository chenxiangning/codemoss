# Wave 1UDS5 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-uds-no-tmp-fallback`  
> 论文对齐：config 是真值；未授权目录不得成为 transport。  
> 结论：**方向正确。这是实洞。** `private_uds_path` 失败不再回落到 `/tmp/mx-open.s`。UDS driver / Worker / MXPD 没有私有路径就不得 handshake。不切产品。
