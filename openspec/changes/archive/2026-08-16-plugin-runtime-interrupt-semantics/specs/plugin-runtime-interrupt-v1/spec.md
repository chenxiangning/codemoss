# plugin-runtime-interrupt-v1 Spec Delta

## ADDED Requirements

### Requirement: Host MUST interrupt the current generation non-terminally

`Host::interrupt(plugin_id, generation)` MUST 反向拓扑 `driver.stop` 停掉该 generation 全部 started entry 的进程（对 `RestrictedProcessDriver` 即进程组 kill），清空 `started` 与 `unit_id`，并把 slot 置回 `Idle`。中断是**非终态**：插件不进入 `Disabled` / `Fused`，下次 `activate` MUST 成功并生成新 generation。

#### Scenario: interrupt stops the process group and returns the slot to Idle

- **WHEN** Notes 已 `activate` 进入 `Ready`（generation = G，started = `["notes-worker", "notes-ui"]`）
- **AND** 调用 `interrupt("com.mossx.notes", G)`
- **THEN** `driver.stopped` MUST 按 `["notes-ui", "notes-worker"]` 反向记录 stop
- **AND** slot 的 `state` MUST 为 `Idle`、`started` 与 `unit_id` MUST 为空
- **AND** 再次 `activate` MUST 成功（新 generation = G+1）

#### Scenario: interrupt rejects a stale or unknown generation

- **WHEN** 调用 `interrupt(plugin_id, 0)` 或 generation 不等于 slot 当前 generation
- **THEN** MUST 返回 `stale-generation`
- **AND** 调用 `interrupt` 于 unknown plugin MUST 返回 `plugin-unavailable`

#### Scenario: interrupt refuses a non-Ready slot

- **WHEN** slot 处于 `Idle` / `Activating` / `Failed` / `Fused` / `Disabled`
- **THEN** `interrupt` MUST 返回对应状态错误，且 MUST NOT 调用 `driver.stop`
