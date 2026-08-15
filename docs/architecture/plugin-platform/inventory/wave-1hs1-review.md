# Wave 1HS1 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-handshake-nonce`  
> 论文对齐：handshake 是发射；相同 nonce 重放不是合法获取。  
> 结论：**方向正确。这是实洞。** spawn / UDS / Named Pipe / Loopback 每次 handshake 独立签发 64 位 hex nonce。写死的 64 个 `a` 不再作为生产常量。codec fixture 仍可用固定 nonce。不切产品。
