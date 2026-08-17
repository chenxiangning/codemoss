# plugin-rack-live-path-v1 Spec Delta

## ADDED Requirements

### Requirement: Rack snapshot MUST report product circuits without claiming Host activation

`get_plugin_rack_snapshot` MUST 包含 supervisor 是否存活及其 pid。Claude / Notes MUST 各带 `productPath` 与 `circuit`。默认产品路径 MUST 为 `live`。显式关闭 MUST 为 `fallback`。Host slot `state` MUST 在 boot 默认路径保持 `idle`，`live` MUST 为 false。later-plugin MUST `circuit=idle` 且 `productPath=undeclared`。本刀 MUST NOT 注册 activate / install / uninstall 命令。

#### Scenario: default boot reports live product circuits

- **WHEN** 未设置 Claude / Notes 关闭旗且 `boot_host()` 成功
- **THEN** Claude `productPath` MUST 为 `process-entry` 且 `circuit` MUST 为 `live`
- **AND** Notes `productPath` MUST 为 `isolated-sqlite` 且 `circuit` MUST 为 `live`
- **AND** 两者 `state` MUST 为 `idle`
- **AND** `supervisorLive` MUST 为 true

#### Scenario: rack UI stays read-only

- **WHEN** 渲染 `PluginRackSection`
- **THEN** 页面 MUST NOT 出现 button
- **AND** 必须展示 supervisor 与试点插头电路
