# Wave 1QJ6 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-worker-handshake`  
> 论文对齐：handshake 是发射；失败必须卸载，不得留下 live isolate。  
> 结论：**方向正确。这是实洞。** Worker isolate 现在必须先完成 in-memory MXPC hello/ack，再插入 catalog。错 nonce 不得留下 isolate；后续 entry 失败会回滚更早 isolate。本刀不嵌 C 引擎。不切产品。
