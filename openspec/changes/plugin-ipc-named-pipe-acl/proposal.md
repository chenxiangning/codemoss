# Proposal: plugin-ipc-named-pipe-acl

> Wave：1NP2（插座本体 · Named Pipe 当前用户 ACL）  
> 依赖：1NP1 名字闸门  
> 论文对齐：拦截是上下文上的权能衰减；未授权主体不得拿到 transport。

## Why

合同要求 Named Pipe ACL 仅当前用户 + Host pid。1NP1 只锁了名字。空 DACL / Everyone 等于把 Control Plane 暴露给本机任意进程。

## 边界

1. NULL / 空允许集 MUST `permission-denied`。
2. `S-1-1-0`（Everyone）与 `S-1-5-11`（Authenticated Users）MUST 拒绝。
3. 允许集 MUST 含当前用户 SID。
4. 本刀只锁 policy；Windows `CreateNamedPipeW` 挂 SD 留给 1NP3。
5. **禁止**进产品切流，禁止 TCP。

## Capabilities

- `plugin-ipc-named-pipe-acl-v1`
