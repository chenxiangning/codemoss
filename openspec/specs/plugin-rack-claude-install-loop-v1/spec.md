# plugin-rack-claude-install-loop-v1 Specification

## Purpose

产品插排对第二根 allowlisted 系统插头 `com.mossx.engine.claude` 提供真实安装 / 卸载闭环：disk lockfile 跨重启、worker-only Host Ready、原子 `claude.engine` + `claude.spawn` contribution、卸载后 spawn 闸门先于 `decide_claude_spawn_owner`。本 capability 不 Slim、不开 Marketplace、不给 later-plugin 装假按钮。

## Requirements

### Requirement: Product MUST persist Claude desired state in the shared lockfile

产品 MUST 把 `com.mossx.engine.claude` 的 desired state 写进同一 disk lockfile（`installed` 或 `uninstalled`）。缺文件时 Claude MUST 视为 `installed`。卸载 MUST 写成 `uninstalled` 并在后续进程读取中保持。lockfile MUST NOT 使用 renderer `localStorage`。

#### Scenario: missing lockfile defaults Claude to installed

- **WHEN** lockfile 文件不存在
- **THEN** Claude desired state MUST 为 `installed`
- **AND** Notes desired state MUST 仍为 `installed`

#### Scenario: Claude uninstall survives a new lockfile read

- **WHEN** 产品卸载 Claude 并写入 lockfile
- **AND** 重新读取同一 lockfile
- **THEN** Claude desired state MUST 为 `uninstalled`

### Requirement: Product MUST install Claude with a worker-only Host lifecycle

安装 `com.mossx.engine.claude` MUST 调用 `prepare_install` 后 `activate_allowlisted(claude_lifecycle_activation_request())`。该 request MUST 只要求 `claude-worker`，MUST NOT 要求 `claude-cli`。Host slot MUST 为 `Ready`；atomic contribution registry MUST 同时拥有 `claude.engine` 与 `claude.spawn`；lockfile MUST 为 `installed`。一般 `activate` MUST 仍因 Host default-off 失败。

#### Scenario: allowlisted Claude install reaches Ready without spawning claude-cli

- **WHEN** Claude 处于 `Uninstalled` 或尚未装入 slot
- **AND** 调用产品 `install_plugin("com.mossx.engine.claude")`
- **THEN** Host slot state MUST 为 `Ready`
- **AND** lifecycle request MUST 仅含 `claude-worker`
- **AND** contribution registry MUST 含 `claude.engine` 与 `claude.spawn`
- **AND** lockfile desired state MUST 为 `installed`

### Requirement: Claude uninstall MUST be a real Host Uninstalled terminal

卸载 `com.mossx.engine.claude` MUST 先写 lockfile `uninstalled`，再 `Host::uninstall` / `PluginRuntime::uninstall_plugin`：slot MUST 为 `Uninstalled`；已 start 的 worker isolate MUST 被 stop；contribution MUST 一次清空。Claude session / history / 制品 MUST 仍存在。`src-tauri/src/engine/claude.rs` MUST 仍存在。

#### Scenario: uninstall stops the Claude isolate and revokes contributions

- **WHEN** Claude 已安装且 Host slot 为 `Ready`
- **AND** 调用 `uninstall_plugin("com.mossx.engine.claude")`
- **THEN** slot state MUST 为 `Uninstalled`
- **AND** contribution registry MUST 不再含 `claude.engine` 或 `claude.spawn`
- **AND** `src-tauri/src/engine/claude.rs` MUST 仍存在
- **AND** lockfile desired state MUST 为 `uninstalled`

### Requirement: Uninstalled Claude MUST NOT silently fall back to Core spawn

当 lockfile 为 `uninstalled` 且未设置 Claude 关闭旗时，产品 spawn 与 resume MUST 在 `decide_claude_spawn_owner` 之前返回 `plugin-uninstalled`，MUST NOT 选择 `CoreCommand`，MUST NOT 调用 `cmd.spawn`。显式 `MOSSX_CLAUDE_PROCESS_ENTRY=0` MUST 仍走 Core spawn。

#### Scenario: default uninstalled refuses Claude spawn before decide

- **WHEN** Claude desired state 为 `uninstalled`
- **AND** 未设置 Claude 关闭旗
- **THEN** `claude_commands_allowed()` MUST 返回错误且错误信息包含 `plugin-uninstalled`
- **AND** 产品 `engine/claude.rs` 源码 MUST 在 `decide_claude_spawn_owner` 之前调用 `claude_commands_allowed`

#### Scenario: explicit process-entry off remains recovery

- **WHEN** `MOSSX_CLAUDE_PROCESS_ENTRY=0`
- **THEN** `claude_commands_allowed()` MUST 成功
- **AND** `decide_claude_spawn_owner(false, _)` MUST 仍为 `CoreCommand`
- **AND** `src-tauri/src/engine/claude.rs` MUST 仍存在

### Requirement: Boot restore MUST honor Claude lockfile without enabling the whole Host

产品 setup MUST 按 lockfile 恢复 Claude：`installed` 则 worker-only allowlisted activate + 注册 contribution；`uninstalled` 则 slot 保持/标为 `Uninstalled` 且 contribution 为空。`boot_host()` 构造函数本身 MUST NOT 激活任何插头。later-plugin MUST 保持未激活。

#### Scenario: restore installed Claude without activating later plugs

- **WHEN** lockfile 中 Claude 为 `installed`
- **AND** 调用产品 restore
- **THEN** Claude slot MUST 为 `Ready`
- **AND** later-plugin slot MUST 仍不存在或非 Ready
- **AND** `Host::activate` 对非 allowlisted 调用 MUST 仍失败
