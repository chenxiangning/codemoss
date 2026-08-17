# project-map-plugin-install-loop-v1 Spec Delta

## ADDED Requirements

### Requirement: Product MUST allowlist Project Map install and uninstall

`is_install_allowlisted` MUST 接受 `com.mossx.project-map`。later-plugin（至少 `com.mossx.browser`）MUST 仍返回 `not-allowlisted`。缺 lockfile 时 Project Map MUST 视为 `installed`。

#### Scenario: allowlist accepts the three pilots

- **WHEN** 调用 `install_plugin("com.mossx.project-map")`
- **THEN** allowlist MUST 接受
- **AND** 调用 `install_plugin("com.mossx.browser")` MUST 被拒绝

### Requirement: Project Map install MUST make Host Ready and contributions live

安装 MUST：`activate_allowlisted` 用 fixture 全量 entries；Host slot MUST 为 `Ready`；contribution MUST 含 `project-map.main`、`project-map.memory` 与 24 条 command；lockfile MUST 为 `installed`。

#### Scenario: install reaches Ready with map contributions

- **WHEN** 调用产品 `install_plugin("com.mossx.project-map")`
- **THEN** Host slot state MUST 为 `Ready`
- **AND** contribution registry MUST 含两 view 与全部 24 条 command
- **AND** lockfile desired state MUST 为 `installed`

### Requirement: Project Map uninstall MUST keep sqlite and refuse default commands

卸载 MUST 使 slot `Uninstalled`、contribution 清空、lockfile `uninstalled`。sqlite MUST 仍存在。未设关闭旗时 24 条产品命令 MUST 返回 `plugin-uninstalled`。显式 `0` MUST 仍走 `*_core`。

#### Scenario: uninstall keeps sqlite and gates commands

- **WHEN** 已安装后调用 `uninstall_plugin("com.mossx.project-map")`
- **THEN** slot MUST 为 `Uninstalled`
- **AND** store.sqlite MUST 仍存在
- **AND** `project_map_commands_allowed()` MUST 返回含 `plugin-uninstalled` 的错误
