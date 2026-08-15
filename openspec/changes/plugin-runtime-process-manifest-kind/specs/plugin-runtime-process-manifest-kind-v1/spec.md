# plugin-runtime-process-manifest-kind-v1 Spec Delta

## ADDED Requirements

### Requirement: Restricted Process MUST follow Manifest kind=process

`RestrictedProcessDriver` MUST 只为 Manifest 声明 `kind=process` 的 entry 创建 child。Worker / UI start MUST 不留下 child。

#### Scenario: notes activation leaves no process child

- **WHEN** Notes 用 Restricted Process driver 激活
- **THEN** live child 数 MUST 为 0
- **AND** slot MUST 为 Ready

#### Scenario: claude activation owns only the process entry

- **WHEN** Claude 用 Restricted Process driver 激活
- **THEN** live child 数 MUST 为 1
- **AND** 该 child MUST 对应 `claude-cli`

#### Scenario: an undeclared process-named entry has no child

- **WHEN** Host start `evil-cli`
- **THEN** live child 数 MUST 为 0
