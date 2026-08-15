# Wave 1HS4 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-handshake-deadline`  
> 论文对齐：handshake 是发射；超时必须卸载，不得一直堵。  
> 结论：**方向正确。这是实洞。** handshake 截止为 2s。Unix 读帧先 `poll`，超时映射 `handshake-timeout`。spawn / UDS handshake 走 timed 读。沉默对端不得完成 handshake。不切产品。
