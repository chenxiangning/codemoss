# plugin-runtime-process-memory-limit-v1 Spec Delta

## ADDED Requirements

### Requirement: Restricted Process MUST have a finite memory limit

`process_memory_limit_ok` MUST 拒绝 `0` 与超过 2048 MiB。spawn MUST 注入有限的 `MOSSX_PROCESS_MEMORY`。Linux MUST 在 exec 前设置 `RLIMIT_AS` 为 512 MiB。macOS MUST 尝试设置 `RLIMIT_DATA`；内核 EINVAL MUST 不把预算改成无限。子进程若看不到声明预算 MUST 不能完成 handshake。MUST NOT 切产品。

#### Scenario: unlimited process memory is rejected

- **WHEN** 配置 Process 内存为 `0`
- **THEN** 闸门 MUST 失败

#### Scenario: a child without an address-space cap cannot complete handshake

- **WHEN** Unix 上 Restricted Process 完成 handshake
- **THEN** 子进程 MUST 看到 `MOSSX_PROCESS_MEMORY=536870912`
- **AND** Linux 上 MUST 同时看到不超过 512 MiB 的 `RLIMIT_AS`
