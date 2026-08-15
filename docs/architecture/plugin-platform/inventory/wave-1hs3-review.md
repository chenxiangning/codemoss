# Wave 1HS3 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-handshake-hello-generation`  
> 论文对齐：handshake 是发射；旧 generation 的 hello 不是合法获取。  
> 结论：**方向正确。这是实洞。** hello 现在必须声明当前 generation。generation 0 / 缺失 / 旧 generation `handshake-rejected`。spawn / UDS / Named Pipe / Loopback / Worker 都按当前 generation 核验。不切产品。
