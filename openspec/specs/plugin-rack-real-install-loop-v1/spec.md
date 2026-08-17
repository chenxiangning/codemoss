# plugin-rack-real-install-loop-v1 Specification

## Purpose

产品插排对 allowlisted 系统插头提供真实安装 / 卸载闭环：disk lockfile 跨重启、Host Ready via `activate_allowlisted`、原子 contribution、卸载终态不可静默回 Core。本 capability 覆盖 Notes（D-050）、Claude（D-051）与 Project Map（D-052）；其它 later-plugin 不得假装可装。

## Requirements

### Requirement: Product MUST persist Notes desired state in a restart-surviving lockfile

产品 MUST 把 allowlisted 插头的 desired state 写成 disk lockfile（`installed` 或 `uninstalled`）。缺文件时 `com.mossx.notes` MUST 视为 `installed`。卸载 MUST 把 Notes 写成 `uninstalled` 并在后续进程读取中保持。lockfile MUST NOT 使用 renderer `localStorage`。

#### Scenario: missing lockfile defaults Notes to installed

- **WHEN** lockfile 文件不存在
- **THEN** Notes desired state MUST 为 `installed`

#### Scenario: uninstall survives a new lockfile read

- **WHEN** 产品卸载 Notes 并写入 lockfile
- **AND** 重新读取同一 lockfile
- **THEN** Notes desired state MUST 为 `uninstalled`

### Requirement: Product MUST expose Notes-only install and uninstall commands

`command_registry` MUST 注册 `install_plugin` 与 `uninstall_plugin`。两命令 MUST 只接受 `com.mossx.notes`、`com.mossx.engine.claude` 与 `com.mossx.project-map`。其它 `pluginId` MUST 返回 allowlist 错误。registry MUST NOT 注册 `activate_plugin`。registry MUST NOT 出现 Marketplace catalog 安装命令。

#### Scenario: Notes is the only allowlisted plug

- **WHEN** 调用 `install_plugin("com.mossx.notes")` 或 `install_plugin("com.mossx.engine.claude")` 或 `install_plugin("com.mossx.project-map")`
- **THEN** 命令 MUST 被 registry 暴露且 allowlist 接受该 id
- **AND** 调用 `install_plugin("com.mossx.browser")` MUST 被拒绝

#### Scenario: registry still refuses generic Host activate

- **WHEN** 读取 `command_registry.rs`
- **THEN** 源码 MUST 包含 `install_plugin` 与 `uninstall_plugin`
- **AND** 源码 MUST NOT 包含 `activate_plugin`

### Requirement: Notes install MUST make Host Ready and contributions live

安装 `com.mossx.notes` MUST：`prepare_install` 后 `activate_allowlisted`；Host slot MUST 为 `Ready`；atomic contribution registry MUST 同时拥有 view `notes.main` 与 7 个 `note_card_*` 命令；lockfile MUST 为 `installed`。一般 `activate` MUST 仍因 Host default-off 失败。

#### Scenario: allowlisted install reaches Ready with all Notes contributions

- **WHEN** Notes 处于 `Uninstalled` 或尚未装入 slot
- **AND** 调用产品 `install_plugin("com.mossx.notes")`
- **THEN** Host slot state MUST 为 `Ready`
- **AND** contribution registry MUST 含 `notes.main` 与全部 `note_card_*`
- **AND** lockfile desired state MUST 为 `installed`

#### Scenario: generic activate stays host-disabled

- **WHEN** 产品 Host 仍 default-off
- **AND** 调用 `Host::activate(notes_activation_request())`
- **THEN** MUST 返回 `host-disabled`

### Requirement: Notes uninstall MUST be a real Host Uninstalled terminal

卸载 `com.mossx.notes` MUST 调用 `Host::uninstall` / `PluginRuntime::uninstall_plugin`：slot MUST 为 `Uninstalled`；已 start 的 worker isolate MUST 被 stop；contribution MUST 一次清空；lockfile MUST 为 `uninstalled`。Notes sqlite / checkpoint 文件 MUST 仍存在。后续 `activate` MUST 仍返回 `uninstalled`，直到再次 `install_plugin`。

#### Scenario: uninstall stops the isolate and revokes contributions

- **WHEN** Notes 已安装且 Host slot 为 `Ready`
- **AND** 调用 `uninstall_plugin("com.mossx.notes")`
- **THEN** slot state MUST 为 `Uninstalled`
- **AND** contribution registry MUST 不再含 Notes view 或 `note_card_*`
- **AND** Notes 数据文件 MUST 仍存在
- **AND** lockfile desired state MUST 为 `uninstalled`

### Requirement: Uninstalled Notes MUST NOT silently fall back to Core

当 lockfile 为 `uninstalled` 且未设置 Notes 关闭旗时，`note_card_*` 产品命令 MUST 返回 `plugin-uninstalled`，MUST NOT 调用 `note_card_*_core`。显式 `MOSSX_NOTES_COMPAT_FACADE=0` MUST 仍走 Core 文件实现。`note_cards.rs` MUST 仍存在。

#### Scenario: default uninstalled refuses Notes commands

- **WHEN** Notes desired state 为 `uninstalled`
- **AND** 未设置 Notes 关闭旗
- **THEN** `note_card_list` MUST 返回错误且错误信息包含 `plugin-uninstalled`
- **AND** MUST NOT 走 `note_card_list_core`

#### Scenario: explicit off remains recovery

- **WHEN** `MOSSX_NOTES_COMPAT_FACADE=0`
- **THEN** Notes 产品命令 MUST 仍可进入 `note_card_*_core`
- **AND** `src-tauri/src/note_cards.rs` MUST 仍存在

### Requirement: Rack UI MUST offer install and uninstall only on Notes

插排 MUST 给 `com.mossx.notes`、`com.mossx.engine.claude` 与 `com.mossx.project-map` 提供安装或卸载按钮，且按钮 MUST 调用产品 `install_plugin` / `uninstall_plugin`。其余已声明插头 MUST 保持无安装/卸载按钮。远程 Marketplace MUST 保持关闭文案。

#### Scenario: only Notes has writable actions

- **WHEN** 渲染插排快照
- **THEN** Notes、Claude 与 Project Map 卡片 MUST 各有安装或卸载 button
- **AND** later-plugin 卡片 MUST 没有安装或卸载 button

### Requirement: Boot restore MUST honor the lockfile without enabling the whole Host

产品 setup MUST 按 lockfile 恢复 Notes、Claude 与 Project Map：`installed` 则 allowlisted activate + 注册 contribution；`uninstalled` 则 slot 保持/标为 `Uninstalled` 且 contribution 为空。`boot_host()` 构造函数本身 MUST NOT 激活任何插头。later-plugin MUST 保持未激活。

#### Scenario: restore installed Notes and leave others idle

- **WHEN** lockfile 中 Notes、Claude 与 Project Map 为 `installed`
- **AND** 调用产品 restore
- **THEN** Notes slot MUST 为 `Ready`
- **AND** Claude slot MUST 为 `Ready`
- **AND** Project Map slot MUST 为 `Ready`
- **AND** later-plugin slot MUST 仍不存在或非 Ready
- **AND** `Host::activate` 对非 allowlisted 调用 MUST 仍失败
