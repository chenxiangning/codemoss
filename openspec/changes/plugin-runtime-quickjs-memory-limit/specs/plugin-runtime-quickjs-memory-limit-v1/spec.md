# plugin-runtime-quickjs-memory-limit-v1 Spec Delta

## ADDED Requirements

### Requirement: Worker QuickJS MUST have a finite memory limit

Worker Runtime MUST 在 handshake 前设置内存上限。默认 MUST 是 128 MiB。`0` 与超过 256 MiB MUST 拒绝。超限分配 MUST 失败。MUST NOT 切产品。

#### Scenario: unlimited worker memory is rejected

- **WHEN** 配置 Worker 内存为 `0`
- **THEN** 闸门 MUST 失败

#### Scenario: an allocation beyond the isolate budget cannot succeed

- **WHEN** Runtime 内存上限是一个很小的有限值
- **AND** Worker 试图分配远超该上限的对象
- **THEN** 分配 MUST 失败
