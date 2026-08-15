# plugin-host-boot-disabled-v1 Spec Delta

## ADDED Requirements

### Requirement: App boot MUST construct a disabled Host and MUST NOT activate product pilots

`run()` MUST 持有 `enabled=false` 的 `PluginRuntime`。对该 runtime 调用 Notes / Claude activate MUST 返回 `host-disabled`，且不得留下 slot。

#### Scenario: boot host rejects notes activation

- **WHEN** 使用 boot 默认 Host 激活 `com.mossx.notes`
- **THEN** 调用 MUST 失败且错误码为 `host-disabled`
- **AND** Host MUST 不创建 slot

#### Scenario: boot host rejects claude activation

- **WHEN** 使用 boot 默认 Host 激活 `com.mossx.engine.claude`
- **THEN** 调用 MUST 失败且错误码为 `host-disabled`
- **AND** Host MUST 不创建 slot
