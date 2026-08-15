# plugin-runtime-compose-v1 Spec Delta

## ADDED Requirements

### Requirement: Core MAY compose Host, Broker, DataPlane and Storage without entering boot

Core MUST 提供不注册 command、不进入 `lib.rs::run` 的组合面。该组合面 MUST 能激活 fixture、查询只读 workspace、打开 generation-bound MXPD stream，并在 disable 后同时拒绝 Broker 与 DataPlane 写入。

#### Scenario: notes fixture can be activated queried streamed then disabled

- **WHEN** PluginRuntime 激活 Notes fixture
- **THEN** Broker read MUST 成功
- **AND** DataPlane 能 open stream
- **WHEN** 随后 disable
- **THEN** Broker read MUST 失败
- **AND** 该 generation 的 stream MUST 被撤销
