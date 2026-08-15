# plugin-manifest-v1 Spec Delta

## ADDED Requirements

### Requirement: Core MUST parse Manifest V1 without executing plugin code

系统 MUST 提供 Manifest V1 parser。解析 MUST 在不读取 Worker/Process/UI/Migration 入口文件、不执行插件 JavaScript 或 executable 的情况下完成。未知 `manifestVersion` MUST 被拒绝。

#### Scenario: notes minimal manifest is accepted

- **WHEN** parser 收到 Contract Freeze 中的 Notes 最小 Manifest
- **THEN** 解析 MUST 成功
- **AND** `pluginId` MUST 为 `com.mossx.notes`

#### Scenario: unknown top-level field is rejected

- **WHEN** Manifest 含有 schema 未声明的 top-level 字段
- **THEN** parser MUST fail closed
- **AND** MUST NOT 忽略该字段后继续激活

#### Scenario: unbounded coreApi range is rejected

- **WHEN** `compatibility.coreApi` 为 `*` 或缺少上界
- **THEN** parser MUST 拒绝该 Manifest

### Requirement: pluginId MUST be an immutable Reverse-DNS identity

`pluginId` MUST 匹配 Reverse-DNS。官方保留 `com.mossx.*`。parser MUST 把 `pluginId` 视为机器身份，不得用 displayName 替代。

#### Scenario: display name change does not change identity

- **WHEN** 两份 Manifest 仅 `displayName` 不同且 `pluginId` 相同
- **THEN** parser MUST 将它们识别为同一 plugin identity
