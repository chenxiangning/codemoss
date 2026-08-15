# plugin-ipc-named-pipe-sddl-v1 Spec Delta

## ADDED Requirements

### Requirement: Named Pipe bind MUST compile a current-user SDDL first

`bind_named_pipe_secured` MUST 在平台 listen 之前调用 `compile_pipe_sddl`。allow 不是恰好当前用户、或 SDDL 含 world SID 时 MUST `permission-denied`。

#### Scenario: current-user sddl is compiled

- **WHEN** owner 与 allow 都是 `S-1-5-21-1-2-3-1001`
- **THEN** `compile_pipe_sddl` MUST 成功
- **AND** 结果 MUST 含该 SID
- **AND** 结果 MUST NOT 含 `WD` 或 `S-1-1-0`

#### Scenario: everyone cannot compile a descriptor

- **WHEN** allow 含 `S-1-1-0`
- **THEN** `compile_pipe_sddl` MUST 失败且错误码为 `permission-denied`
