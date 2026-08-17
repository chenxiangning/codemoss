# plugin-runtime-uninstall-v1 Spec Delta

## ADDED Requirements

### Requirement: Allowlisted install MUST recover an Uninstalled Notes slot

`Host::prepare_install(plugin_id)` MUST 把 `Uninstalled` slot 收回到 `Idle`（清空 `started` 与 `unit_id`）。随后 `activate_allowlisted` MUST 能再次进入 `Ready`。未走 install 的 `activate` / `reset` MUST 仍对 `Uninstalled` 返回 `uninstalled`。

#### Scenario: Notes can be reinstalled after uninstall

- **WHEN** Notes slot 处于 `Uninstalled`
- **AND** 调用 `prepare_install("com.mossx.notes")`
- **AND** 调用 `activate_allowlisted(notes_activation_request())`
- **THEN** slot state MUST 为 `Ready`
- **AND** 未先 install 的 `activate` MUST 仍返回 `uninstalled`
