# plugin-entry-dag-v1 Spec Delta

## ADDED Requirements

### Requirement: Entries MUST use a closed kind discriminant

每个 entry MUST 声明唯一 `id` 与 `kind`，且 `kind` MUST 为 `worker`、`process`、`ui`、`migration` 之一。未知 kind MUST 被拒绝。Contribution 与 Activation Unit MUST 引用稳定 `entryId`，不得用路径充当身份。

#### Scenario: unknown kind is rejected

- **WHEN** entries 含 `kind: sidecar`
- **THEN** parser MUST 拒绝

#### Scenario: dangling entryId is rejected

- **WHEN** Activation Unit 或 contribution 引用不存在的 `entryId`
- **THEN** parser MUST 拒绝

### Requirement: Physical DAG MUST be acyclic and statically declared

`dependsOn` MUST 形成有向无环图。cycle、自依赖、required 边指向缺失平台 process key，MUST 在解析期失败。Migration entry MUST NOT 出现在 `dependsOn` 或 `activationUnits.entries`。

#### Scenario: cyclic dependsOn is rejected

- **WHEN** A dependsOn B 且 B dependsOn A
- **THEN** parser MUST 拒绝

#### Scenario: migration cannot join an activation unit

- **WHEN** Activation Unit 的 entries 包含 migration kind
- **THEN** parser MUST 拒绝

### Requirement: Activation units MUST be the smallest start/stop unit

Manifest MUST 使用 `activationUnits`。系统 MUST NOT 接受隐式“激活整个 plugin”。V1 event type MUST 仅来自 `onView`、`onCommand`、`onEngine`、`onWorkspace`、`onSettings`、`onStartup`。

#### Scenario: unknown event type is rejected

- **WHEN** unit 声明 `type: onFile`
- **THEN** parser MUST 拒绝

#### Scenario: onStartup is rejected for non-allowlisted plugins

- **WHEN** trustTier 不是 system，或 pluginId 不在 startup allowlist，且 unit 含 `onStartup`
- **THEN** parser MUST 拒绝
