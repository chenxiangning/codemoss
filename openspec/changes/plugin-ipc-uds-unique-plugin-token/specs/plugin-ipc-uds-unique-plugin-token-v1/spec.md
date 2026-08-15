# plugin-ipc-uds-unique-plugin-token-v1 Spec Delta

## ADDED Requirements

### Requirement: private UDS directory token MUST bind the full pluginId

`private_uds_dir` MUST 用完整 pluginId 派生短 token。同后缀的不同 pluginId MUST 不得共享目录。

#### Scenario: same-suffix plugins do not share a uds directory

- **WHEN** 分别为 `com.mossx.notes` 与 `com.evil.notes` 取私有 UDS 目录
- **THEN** 它们 MUST 不同
- **AND** 两个目录 MUST 都是 0700
