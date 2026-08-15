# Wave 1HS8 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-handshake-hello-deadline`  
> 论文对齐：handshake 是发射；沉默连接不得占用 accept。  
> 结论：**方向正确。这是实洞。** UDS / Worker 接受端读 hello 现在走 2s timed 读。连接后不写帧 `handshake-timeout`。不切产品。
