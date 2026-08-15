# Wave 1HS9 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-handshake-ack-version`  
> 论文对齐：handshake 是发射；未声明版本的对端不是合法获取。  
> 结论：**方向正确。这是实洞。** ack 现在必须声明当前 Manifest version。缺失 / `9.9.9` `handshake-rejected`。spawn / UDS / Named Pipe / Loopback / Worker 都按 `1.0.0` 核验。不切产品。
