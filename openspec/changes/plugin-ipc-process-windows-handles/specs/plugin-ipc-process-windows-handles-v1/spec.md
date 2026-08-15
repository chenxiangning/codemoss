# plugin-ipc-process-windows-handles-v1 Spec Delta

## ADDED Requirements

### Requirement: Windows Restricted Process MUST NOT inherit extra handles

Windows spawn MUST 先过 `windows_process_flags_ok` 与 `windows_inherit_handles_ok`。缺 `CREATE_NO_WINDOW` 或请求额外 inherit MUST 不得留下 child。

#### Scenario: create-no-window without extra inherit is accepted

- **WHEN** flags 含 `CREATE_NO_WINDOW` 且 `inherit_extra` 为 false
- **THEN** 两道闸门 MUST 成功

#### Scenario: extra inherit cannot leave a child

- **WHEN** `windows_inherit_handles_ok(true)`
- **THEN** 校验 MUST 失败
