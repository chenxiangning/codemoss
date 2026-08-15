# Proposal: plugin-ipc-named-pipe-sddl

> Wave：1NP5（插座本体 · Named Pipe 必须先编译当前用户 SDDL）  
> 依赖：1NP4 bind ACL  
> 论文对齐：未授权主体不得获取 transport；Everyone 不得进入 descriptor。

## Why

1NP4 只在 bind 前调用 `pipe_acl_ok`。Windows `CreateNamedPipeW` 仍传 NULL DACL。政策对象和 OS descriptor 是两回事。本刀把 ACL 编成 SDDL，bind 必须拿这份 descriptor；Everyone / 额外主体不得编译成功。

## 边界

1. `compile_pipe_sddl` MUST 只接受当前用户 SID，且 allow 必须恰好等于 owner。
2. 产出的 SDDL MUST 含 owner，MUST NOT 含 `WD` / `S-1-1-0` / `S-1-5-11`。
3. `bind_named_pipe_secured` MUST 先编译 SDDL，再 listen。
4. Windows bind MUST 用该 SDDL 构造 `SECURITY_ATTRIBUTES`；编译失败不得 `CreateNamedPipeW`。
5. 不切产品。

## Capabilities

- `plugin-ipc-named-pipe-sddl-v1`
