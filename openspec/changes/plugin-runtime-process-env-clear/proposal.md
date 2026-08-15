# Proposal: plugin-runtime-process-env-clear

> Wave：1F5（插座本体 · Restricted Process 不得继承父进程环境）  
> 依赖：1F2 handshake、1F4 allowlist  
> 论文对齐：获取必须最小；未声明环境不得进入子进程。

## Why

合同要求 process inheritance / handle leakage 防护，以及 nonce 安全交付。`RestrictedProcessDriver` 现在只追加 `MOSSX_*`，父进程的 `HOME` / `PATH` / 密钥会一起进 child。这把 Restricted Process 变成密钥泄漏面。

## 边界

1. spawn MUST `env_clear`，再只注入 handshake 变量。
2. 允许的变量 MUST 仅：`MOSSX_HANDSHAKE_NONCE`、`MOSSX_PLUGIN_ID`、`MOSSX_GENERATION`；测试损坏路径可加 `MOSSX_CORRUPT_ACK`。
3. 父进程设置的 `MOSSX_SHOULD_NOT_INHERIT` MUST 不得出现在 child。
4. Windows 可保留 `SYSTEMROOT`，不得保留用户密钥。
5. 不切产品。

## Capabilities

- `plugin-runtime-process-env-clear-v1`
