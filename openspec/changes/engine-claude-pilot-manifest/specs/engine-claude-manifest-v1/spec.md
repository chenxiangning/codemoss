# engine-claude-manifest-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude Pilot MUST declare an exact Engine Contribution

`com.mossx.engine.claude` Manifest MUST exact declare `mossx.engine.provider` 且 `engineId` 为 `claude`。Engine Contribution MUST 挂在 Worker Entry 上。Worker MUST `dependsOn` 对应 Process Entry。激活 MUST 使用 `onEngine`，MUST NOT 使用 `onStartup`。V1 Claude Manifest MUST NOT 声明 `trusted-react`。

#### Scenario: claude engine fixture is accepted

- **WHEN** parser 读取 `fixtures/valid/claude-engine.json` 且 trustTier 为 system
- **THEN** 解析 MUST 成功
- **AND** `pluginId` MUST 为 `com.mossx.engine.claude`

#### Scenario: engine provider cannot be a template

- **WHEN** 同一 Manifest 用 `contributionTemplates` 产生 `mossx.engine.provider`
- **THEN** parser MUST 拒绝
