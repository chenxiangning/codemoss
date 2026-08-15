# Proposal: plugin-ipc-named-pipe-bind-acl

> Wave：1NP4（插座本体 · Named Pipe bind 必须先过 ACL）  
> 依赖：1NP2 `pipe_acl_ok`、1NP3 Host driver  
> 论文对齐：未授权主体不得获取 transport。

## Why

`pipe_acl_ok` 是纯函数。`bind_named_pipe` 只验名字，Windows `CreateNamedPipeW` 仍传 NULL DACL。Everyone 政策不过 bind 面就等于没闸。

## 边界

1. 公开 bind MUST 先 `pipe_name_ok` 再 `pipe_acl_ok`。
2. Everyone / 空 ACL MUST 在 bind 入口失败，不得落到平台 listen。
3. 真实 Windows SECURITY_DESCRIPTOR 仍可后续加厚；本刀先把政策接到 bind。
4. 不切产品。

## Capabilities

- `plugin-ipc-named-pipe-bind-acl-v1`
