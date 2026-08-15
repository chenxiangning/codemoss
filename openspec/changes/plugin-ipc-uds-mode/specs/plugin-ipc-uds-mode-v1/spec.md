# plugin-ipc-uds-mode-v1 Spec Delta

## ADDED Requirements

### Requirement: UDS bind MUST be current-user only

`bind_uds` 成功后 socket 文件 mode MUST 为 `0o600`。

#### Scenario: a bound uds is owner-only

- **WHEN** unix 上 `bind_uds` 成功
- **THEN** 该路径的权限 MUST 为 `0o600`
