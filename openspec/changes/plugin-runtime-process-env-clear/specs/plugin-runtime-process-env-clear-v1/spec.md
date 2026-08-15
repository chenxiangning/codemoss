# plugin-runtime-process-env-clear-v1 Spec Delta

## ADDED Requirements

### Requirement: Restricted Process MUST NOT inherit the parent environment

spawn MUST 清空父进程环境，再只注入 handshake 变量。父进程中的 `MOSSX_SHOULD_NOT_INHERIT` MUST 不得出现在 child。

#### Scenario: a parent leak probe cannot complete handshake

- **WHEN** 父进程设置 `MOSSX_SHOULD_NOT_INHERIT`
- **AND** Claude 用 handshake driver 激活
- **THEN** handshake MUST 成功
- **AND** live child 数 MUST 为 1
