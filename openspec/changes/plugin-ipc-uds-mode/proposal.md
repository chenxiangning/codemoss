# Proposal: plugin-ipc-uds-mode

> Wave：1UDS2（插座本体 · UDS 当前用户 0600）  
> 依赖：1E bind_uds、1NP2 Named Pipe ACL  
> 论文对齐：transport 是获取；未授权主体不得连接。

## Why

合同要求 Named Pipe / UDS ACL 仅当前用户。Named Pipe 已有 `pipe_acl_ok`。`bind_uds` 仍用默认 umask，`/tmp` 上可能是 0777/0755，本机任意用户可连 Control Plane。

## 边界

1. `bind_uds` 成功后 socket MUST 为 `0o600`。
2. 不得改产品路径，不得进 Marketplace。

## Capabilities

- `plugin-ipc-uds-mode-v1`
