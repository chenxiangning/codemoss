# Wave 1HS5 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-handshake-full-frame-deadline`  
> 论文对齐：handshake 是发射；半帧不是完成，超时必须卸载。  
> 结论：**方向正确。这是实洞。** `read_mxpc_frame_timed` 现在用同一 deadline 覆盖 header 与 payload。只回 header 的对端 `handshake-timeout`。0755 父目录测试改到独立目录，避免污染共享 0700 私有目录。不切产品。
