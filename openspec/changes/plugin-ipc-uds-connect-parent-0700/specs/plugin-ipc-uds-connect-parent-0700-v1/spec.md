# plugin-ipc-uds-connect-parent-0700-v1 Spec Delta

## ADDED Requirements

### Requirement: UDS connect MUST require parent directory 0700

`connect_uds` MUST 拒绝父目录不是恰好 0700 的路径。`/tmp` 与 0755 父目录 MUST `permission-denied`，且 MUST NOT 发起 connect。

#### Scenario: a socket in tmp cannot be connected

- **WHEN** `connect_uds` 收到 `/tmp/mx-open.s`
- **THEN** 它 MUST `permission-denied`

#### Scenario: a world-readable parent cannot be connected

- **WHEN** UDS 父目录是 0755
- **THEN** `connect_uds` MUST `permission-denied`
