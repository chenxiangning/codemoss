# plugin-storage-lkg-skeleton-v1 Spec Delta

## ADDED Requirements

### Requirement: PluginRuntime MUST stage a candidate update before committing LKG

`stage_own_update` MUST 仅在 Host slot 为 `ready` 且已有校验过的 checkpoint 时，对 candidate 执行 migrate，并记住 stage 前的 checkpoint。本步 MUST NOT 写入 `plugin-lock.json`。

#### Scenario: ready plugin can stage a compatible candidate

- **WHEN** Notes 已 ready 且已 checkpoint
- **AND** plan 为 compatible
- **THEN** `stage_own_update` MUST 成功且 schema 变为 plan.to
- **AND** `{storage_root}/plugin-lock.json` MUST 仍不存在该 plugin 的 pin

#### Scenario: disabled plugin cannot stage an update

- **WHEN** plugin 已被 disable
- **THEN** `stage_own_update` MUST 失败且错误码为 `plugin-unavailable`

### Requirement: Health pass MUST atomically pin LKG

`complete_own_update(Pass)` MUST 把 `{pluginId, pluginVersion, checkpointId, schemaVersion}` 原子写入 `{storage_root}/plugin-lock.json`，并保护该 checkpoint 不被 `retainPrevious` 清掉。

#### Scenario: health pass commits LKG pin

- **WHEN** Notes candidate 已 stage
- **AND** health 为 pass
- **THEN** `plugin-lock.json` MUST 含该 plugin 的 pin
- **AND** pin.checkpointId MUST 等于 stage 前 checkpoint
- **AND** pin.schemaVersion MUST 等于 candidate schema

### Requirement: Health fail MUST restore data and keep previous LKG

`complete_own_update(Fail)` MUST restore 到 stage 前 checkpoint。若已有 LKG pin，MUST 保持不变。若没有 LKG pin，MUST 返回 quarantine，且不得新写 pin。

#### Scenario: health fail restores and keeps previous pin

- **WHEN** Notes 已有 LKG pin
- **AND** 新 candidate 已 stage
- **AND** health 为 fail
- **THEN** store schema MUST 回到 stage 前
- **AND** `plugin-lock.json` 中该 plugin 的 pin MUST 仍是旧 pin

#### Scenario: health fail without LKG quarantines

- **WHEN** Notes 从未 commit 过 LKG
- **AND** candidate 已 stage
- **AND** health 为 fail
- **THEN** 结果 MUST 为 quarantine
- **AND** `plugin-lock.json` MUST 不出现该 plugin 的 pin

### Requirement: LKG pin file MUST stay separate from product desired-state lockfile

本刀写入的 LKG 文件 MUST 是 `{storage_root}/plugin-lock.json`。MUST NOT 创建或改写产品 `plugin-lockfile.json`。

#### Scenario: LKG commit does not touch product lockfile

- **WHEN** health pass 写入 LKG pin
- **THEN** `{storage_root}/plugin-lockfile.json` MUST 不存在
- **AND** `{storage_root}/plugin-lock.json` MUST 存在
