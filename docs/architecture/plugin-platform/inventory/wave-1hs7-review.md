# Wave 1HS7 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-handshake-hello-nonce`  
> 论文对齐：handshake 是发射；外来 nonce 不是本次激活的获取。  
> 结论：**方向正确。这是实洞。** hello 现在必须回显本次签发 nonce。形状对但值不对的外来 hello `handshake-rejected`。UDS / Named Pipe / Worker / Loopback 接受端都按签发值核验。不切产品。
