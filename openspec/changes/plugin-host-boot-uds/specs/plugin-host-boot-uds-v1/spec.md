# plugin-host-boot-uds-v1 Spec Delta

## ADDED Requirements

### Requirement: Boot Host MUST use the UDS supervisor and MUST stay disabled

`boot_host()` MUST 构造 `UdsHandshakeDriver` 的 `PluginRuntime`。对该 runtime 激活 Notes / Claude MUST 返回 `host-disabled`，且 driver MUST 不记录任何 start。

#### Scenario: boot uds host rejects notes without starting a socket

- **WHEN** 使用 boot Host 激活 `com.mossx.notes`
- **THEN** 调用 MUST 失败且错误码为 `host-disabled`
- **AND** UDS driver `started` MUST 为空

#### Scenario: boot uds host rejects claude without starting a socket

- **WHEN** 使用 boot Host 激活 `com.mossx.engine.claude`
- **THEN** 调用 MUST 失败且错误码为 `host-disabled`
- **AND** UDS driver `started` MUST 为空
