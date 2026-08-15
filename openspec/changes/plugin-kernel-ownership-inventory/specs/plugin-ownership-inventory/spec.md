# plugin-ownership-inventory Spec Delta

## ADDED Requirements

### Requirement: Core MUST maintain a machine-readable ownership inventory

系统 MUST 维护一份机器可读的 ownership inventory，覆盖当前 frontend feature 顶层目录与 Rust engine 顶层模块。每一行 MUST 包含 path、layer、ownerClass，以及适用时的 targetPluginId。ownerClass MUST 是 `core`、`pilot`、`later-plugin`、`retired-unreferenced` 之一。

#### Scenario: inventory covers current feature directories

- **WHEN** 维护者运行 inventory 生成或校验
- **THEN** `src/features/*` 每个顶层目录 MUST 出现在 inventory 中
- **AND** `src-tauri/src/engine/*` 每个顶层模块 MUST 出现在 inventory 中

#### Scenario: pilots are uniquely identified

- **WHEN** 读取 inventory
- **THEN** 至少一行 owner 的 targetPluginId 为 `com.mossx.engine.claude`
- **AND** 至少一行 owner 的 targetPluginId 为 `com.mossx.notes`
- **AND** 不得把其他 Engine 标成这两个 Pilot identity

### Requirement: Product code MUST NOT be deleted until its ownerClass allows it

系统 MUST NOT 在 ownerClass 仍为 `core`、`pilot` 或 `later-plugin` 时删除对应生产实现。仅 `retired-unreferenced` 允许在附带引用扫描证据后删除。

#### Scenario: later-plugin module remains in the tree

- **WHEN** Wave 0A 完成
- **THEN** 被标为 `later-plugin` 的 feature 与 engine 实现 MUST 仍存在于工作树
- **AND** 用户可见产品行为 MUST 保持不变

#### Scenario: retired-unreferenced requires evidence

- **WHEN** 某路径被标为 `retired-unreferenced` 并准备删除
- **THEN** 必须存在引用扫描证据证明 production import 与 Native registration 均不引用该路径
