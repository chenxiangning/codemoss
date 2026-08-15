# plugin-runtime-unknown-lifecycle-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST refuse fuse disable and reset on an unknown or blank plugin

空白 `pluginId` 的 `fuse_plugin` / `disable_plugin` / `reset_plugin` MUST 返回 `schema`。从未加载的 `pluginId` MUST 返回 `plugin-unavailable`。两者都不得写入 slot。

#### Scenario: a blank plugin id cannot change lifecycle

- **WHEN** `plugin_id` 为空或仅空白
- **THEN** fuse / disable / reset MUST 失败且错误码为 `schema`

#### Scenario: an unknown plugin cannot change lifecycle

- **WHEN** `plugin_id` 从未 activate
- **THEN** fuse / disable / reset MUST 失败且错误码为 `plugin-unavailable`
- **AND** Host MUST 不创建对应 slot
