# plugin-runtime-restricted-spawn-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST treat Restricted Process spawn as a revertible effect

`RestrictedProcessDriver::start` MUST 拉起 allowlisted child。`stop` MUST 杀掉该 generation 的 child。未知可执行文件 MUST 失败且不得留下进程。第二个 required entry 失败时，Host MUST 反向 stop 已启动 child。

#### Scenario: a ready unit owns a live child that disable can kill

- **WHEN** Notes 用 Restricted Process driver 激活成功
- **THEN** driver MUST 记录一个 live child
- **AND** `disable` MUST 使该 child 不再存活

#### Scenario: a later entry crash kills the earlier child

- **WHEN** 第二个 required entry start 失败
- **THEN** 第一个 child MUST 被 stop
- **AND** slot state MUST 为 Failed

#### Scenario: an unknown executable cannot spawn

- **WHEN** allowlist 指向不存在的路径
- **THEN** `activate` MUST 失败
- **AND** driver MUST 不持有 live child
