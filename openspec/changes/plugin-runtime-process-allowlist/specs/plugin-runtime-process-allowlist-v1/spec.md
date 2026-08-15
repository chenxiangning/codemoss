# plugin-runtime-process-allowlist-v1 Spec Delta

## ADDED Requirements

### Requirement: Restricted Process MUST deny undeclared shells and interpreters

`RestrictedProcessDriver` MUST 在 spawn 前调用 `process_executable_ok`。相对路径、`..`、已知 shell / 解释器 MUST 失败且不得留下 child。

#### Scenario: a shell executable cannot leave a child

- **WHEN** driver 的 executable 为 `/bin/sh` 或 `cmd.exe`
- **AND** Host start `claude-cli`
- **THEN** 调用 MUST 失败
- **AND** live child 数 MUST 为 0

#### Scenario: the idle fixture remains allowed

- **WHEN** driver 使用 idle fixture executable
- **AND** Claude 激活
- **THEN** live child 数 MUST 为 1
