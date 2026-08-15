# Wave 1NP4 Self-Review

> 日期：2026-08-16  
> 范围：`plugin-ipc-named-pipe-bind-acl`  
> 结论：**方向正确。这是实洞。** `bind_named_pipe` / `bind_named_pipe_secured` 在 listen 前必须过 `pipe_acl_ok`。Everyone 在入口失败，不得落到 `CreateNamedPipeW`。Windows 真实 SECURITY_DESCRIPTOR 仍未挂；本刀先把政策接到 bind。不切产品。
