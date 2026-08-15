# plugin-ipc-named-pipe-bind-acl-v1 Spec Delta

## ADDED Requirements

### Requirement: Named Pipe bind MUST apply the current-user ACL

公开 bind MUST 在平台 listen 之前调用 `pipe_acl_ok`。Everyone / 空允许集 MUST 返回 `permission-denied`。

#### Scenario: bind with everyone is denied before listen

- **WHEN** `bind_named_pipe_secured` 的 allow 含 `S-1-1-0`
- **THEN** 调用 MUST 失败且错误码为 `permission-denied`
