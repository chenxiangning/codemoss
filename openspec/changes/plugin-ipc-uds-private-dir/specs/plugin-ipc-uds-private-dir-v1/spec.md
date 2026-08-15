# plugin-ipc-uds-private-dir-v1 Spec Delta

## ADDED Requirements

### Requirement: UDS MUST bind inside an owner-only directory

`bind_uds` MUST 拒绝父目录 world-writable（含 `/tmp`）。成功 bind 的 socket MUST 位于 mode `0700` 的目录中，且自身仍为 `0600`。

#### Scenario: a socket in /tmp is rejected

- **WHEN** `bind_uds("/tmp/mx-open.s")`
- **THEN** 调用 MUST 失败且错误码为 `permission-denied`

#### Scenario: a socket in a private directory is accepted

- **WHEN** unix 上在 `private_uds_dir` 内 bind
- **THEN** 父目录权限 MUST 为 `0700`
- **AND** socket 权限 MUST 为 `0600`
