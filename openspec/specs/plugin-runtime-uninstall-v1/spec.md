# plugin-runtime-uninstall-v1 Specification

## Purpose
TBD - created by archiving change plugin-runtime-uninstall-semantics. Update Purpose after archive.
## Requirements
### Requirement: Host MUST uninstall a plugin into an irreversible Uninstalled terminal state

`Host::uninstall(plugin_id)` MUST 从 `Ready` 反向拓扑 `driver.stop` 停掉全部 started entry 的进程组（对 `RestrictedProcessDriver` 即进程组 kill），清空 `started` 与 `unit_id`，并把 slot 置为 `Uninstalled`。卸载是**不可恢复终态**：`activate`/`fuse`/`disable`/`interrupt`/`reset` MUST 返回 `uninstalled`，直到重新 install（后续 change）。

#### Scenario: uninstall stops the process group and becomes irreversible

- **WHEN** Notes 已 `activate` 进入 `Ready`（generation = G，started = `["notes-worker", "notes-ui"]`）
- **AND** 调用 `uninstall("com.mossx.notes")`
- **THEN** `driver.stopped` MUST 按 `["notes-ui", "notes-worker"]` 反向记录 stop
- **AND** slot 的 `state` MUST 为 `Uninstalled`、`started` 与 `unit_id` MUST 为空
- **AND** `activate` MUST 返回 `uninstalled`，`reset` MUST 返回 `uninstalled`

#### Scenario: uninstall is idempotent and refuses an activating slot

- **WHEN** 调用 `uninstall` 于已 `Uninstalled` 的 slot
- **THEN** MUST 返回 `Ok`
- **AND** 调用 `uninstall` 于 `Activating` slot MUST 返回 `activation-busy`

#### Scenario: uninstall from a non-Ready loaded state enters the terminal state

- **WHEN** slot 处于 `Idle` / `Disabled` / `Fused`
- **AND** 调用 `uninstall`
- **THEN** slot 的 `state` MUST 为 `Uninstalled`，且 MUST NOT 调用 `driver.stop`（进程已停）
- **AND** 调用 `uninstall` 于 `Failed` slot MUST 返回 `failed`

### Requirement: slot_state_name MUST expose the Uninstalled terminal

`slot_state_name(SlotState::Uninstalled)` MUST 返回 `"uninstalled"`。

#### Scenario: the terminal state has a stable name

- **WHEN** 调用 `Host::slot_state_name(SlotState::Uninstalled)`
- **THEN** MUST 返回 `"uninstalled"`

### Requirement: PluginRuntime MUST uninstall a plugin and revoke its streams

`PluginRuntime::uninstall_plugin(plugin_id)` MUST 组合 `Host::uninstall` 与 `DataPlane::revoke`，使卸载同时撤销状态机（进 `Uninstalled`）与 DataPlane stream，对称 `disable_plugin` / `fuse_plugin`。

#### Scenario: uninstalling drops the slot into the terminal and revokes streams

- **WHEN** Notes 已 `activate` 并 `open_stream`（stream_id = 3）
- **AND** 调用 `uninstall_plugin("com.mossx.notes")`
- **THEN** slot 的 `state` MUST 为 `Uninstalled`
- **AND** `plane.codec(3)` MUST 为 `None`

### Requirement: Allowlisted install MUST recover an Uninstalled Notes slot

`Host::prepare_install(plugin_id)` MUST 把 `Uninstalled` slot 收回到 `Idle`（清空 `started` 与 `unit_id`）。随后 `activate_allowlisted` MUST 能再次进入 `Ready`。未走 install 的 `activate` / `reset` MUST 仍对 `Uninstalled` 返回 `uninstalled`。

#### Scenario: Notes can be reinstalled after uninstall

- **WHEN** Notes slot 处于 `Uninstalled`
- **AND** 调用 `prepare_install("com.mossx.notes")`
- **AND** 调用 `activate_allowlisted(notes_activation_request())`
- **THEN** slot state MUST 为 `Ready`
- **AND** 未先 install 的 `activate` MUST 仍返回 `uninstalled`

### Requirement: Allowlisted install MUST recover an Uninstalled Claude slot

`Host::prepare_install("com.mossx.engine.claude")` MUST 把 `Uninstalled` slot 收回到 `Idle`。随后 `activate_allowlisted(claude_lifecycle_activation_request())` MUST 能再次进入 `Ready`。未走 install 的 `activate` / `reset` MUST 仍对 `Uninstalled` 返回 `uninstalled`。

#### Scenario: Claude can be reinstalled after uninstall

- **WHEN** Claude slot 处于 `Uninstalled`
- **AND** 调用 `prepare_install("com.mossx.engine.claude")`
- **AND** 调用 `activate_allowlisted(claude_lifecycle_activation_request())`
- **THEN** slot state MUST 为 `Ready`
- **AND** 未先 install 的 `activate` MUST 仍返回 `uninstalled`

