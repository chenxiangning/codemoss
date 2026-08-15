# Wave 1UDS4 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-uds-peer-uid`  
> 论文对齐：隔离 = 独立上下文；未授权主体不得获取 transport。  
> 结论：**方向正确。这是实洞。** UDS `accept` / `connect` 现在必须先过 `uds_peer_ok`。当前用户 uid 通过；外用户 uid `permission-denied`。macOS 用 `getpeereid`，Linux 用 `SO_PEERCRED`。不要求 peer pid 等于 Host（Restricted Process 是另一 pid）。不切产品。
