# plugin-ipc-named-pipe-acl-v1 Spec Delta

## ADDED Requirements

### Requirement: Named Pipe ACL MUST allow only the current user

`pipe_acl_ok` MUST 拒绝 NULL / 空允许集、Everyone 与 Authenticated Users。允许集 MUST 包含当前用户 SID。

#### Scenario: an empty allow list is denied

- **WHEN** ACL 条目为空
- **THEN** 调用 MUST 失败且错误码为 `permission-denied`

#### Scenario: everyone or authenticated users are denied

- **WHEN** ACL 含 `S-1-1-0` 或 `S-1-5-11`
- **THEN** 调用 MUST 失败且错误码为 `permission-denied`

#### Scenario: current user only is accepted

- **WHEN** owner 与唯一 allow SID 都是当前用户
- **THEN** `pipe_acl_ok` MUST 成功
