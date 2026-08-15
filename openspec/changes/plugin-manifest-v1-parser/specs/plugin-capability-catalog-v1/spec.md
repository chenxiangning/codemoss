# plugin-capability-catalog-v1 Spec Delta

## ADDED Requirements

### Requirement: Cross-plugin capabilities MUST be limited to the V1 mossx catalog

V1 Manifest 声明的跨插件 capability MUST 属于 Platform Catalog。`<pluginId>.*` capability MUST 仅视为同一插件私有。未知 `mossx.*` ID MUST 被拒绝。

#### Scenario: unknown mossx capability is rejected

- **WHEN** Manifest 声明 `mossx.filesystem.raw`
- **THEN** parser MUST 拒绝

#### Scenario: foreign private capability is rejected

- **WHEN** 插件 A 声明 require `com.other.plugin.private.x`
- **THEN** parser MUST 拒绝

### Requirement: Contribution templates MUST stay inside the bounded catalog

仅 `mossx.tool`、`mossx.search.provider`、`mossx.context.provider`、`mossx.status.item` MAY 使用 template。template 的 `keyPrefix` MUST 以该插件 `pluginId + "."` 开头。`maxInstances` MUST 在 1 与 256 之间。Engine、View、Command、Trusted React MUST exact declare。

#### Scenario: engine template is rejected

- **WHEN** contributionTemplates 的 type 为 `mossx.engine.provider`
- **THEN** parser MUST 拒绝

#### Scenario: trusted-react on local trust is rejected

- **WHEN** UI entry `mode` 为 `trusted-react` 且 trustTier 为 `local` 或 `verified`
- **THEN** parser MUST 拒绝
