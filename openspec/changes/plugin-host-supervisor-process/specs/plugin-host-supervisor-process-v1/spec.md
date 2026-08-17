# plugin-host-supervisor-process-v1 Spec Delta

## ADDED Requirements

### Requirement: Boot Host MUST supervise a separate host-disabled process

`BootHost` MUST spawn 独立 `host-supervisor` executable 监听私有 UDS。意外连接 MUST 收到 `host-disabled`。该进程 MUST NOT 激活 Claude / Notes。`boot_driver()` MUST 仍 `missing_executable()`。drop MUST 杀掉 supervisor 进程组。本刀 MUST NOT Slim。

#### Scenario: supervisor lives in another pid

- **WHEN** `boot_host()` 成功
- **THEN** supervisor pid MUST 不等于当前测试进程
- **AND** 连接 UDS MUST 读到 `host-disabled`

#### Scenario: boot still does not activate products

- **WHEN** 读取 `boot.rs`
- **THEN** 源码 MUST 仍含 `missing_executable()`
- **AND** MUST NOT 含 `spawn_process_entry_turn`
