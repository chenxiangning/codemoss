# plugin-ipc-uds-parent-0700-v1 Spec Delta

## ADDED Requirements

### Requirement: UDS parent directory MUST be exactly 0700

`bind_uds` MUST 拒绝父目录 mode 不是 `0o700` 的路径。0755 可读父目录 MUST `permission-denied`。

#### Scenario: a world-readable parent cannot bind

- **WHEN** UDS 父目录被设为 0755
- **THEN** `bind_uds` MUST `permission-denied`

#### Scenario: an owner-only parent can bind

- **WHEN** UDS 父目录是 0700
- **THEN** `bind_uds` MUST 成功
- **AND** socket 自身 MUST 仍是 0600
