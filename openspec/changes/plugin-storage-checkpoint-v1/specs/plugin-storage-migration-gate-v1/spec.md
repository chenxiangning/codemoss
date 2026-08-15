# plugin-storage-migration-gate-v1 Spec Delta

## ADDED Requirements

### Requirement: destructive and unknown-schema updates MUST fail closed

destructive migration MUST 在 `confirmed=true` 后才运行。`exportRequired=true` MUST 在用户可见 export 完成后才运行。reader 的 `storageSchemaVersion` 低于 store 的未知 schema MUST `quarantine`，MUST NOT 让旧代码打开。

#### Scenario: unconfirmed destructive migrate is rejected

- **WHEN** migration `destructive=true` 且未确认
- **THEN** service MUST 拒绝

#### Scenario: old reader cannot open newer schema

- **WHEN** store schema 为 2 而 reader 只声明 1
- **THEN** open MUST 返回 `quarantine`
