# engine-claude-process-entry-peer-v1 Spec Delta

## ADDED Requirements

### Requirement: Claude Process Entry path MUST come from the Manifest platform map

Host MUST 从 Claude Manifest 的 `claude-cli` process entry 读取 `platforms[currentPlatform]`，并相对 plugin artifact root 解析为绝对路径。未知平台、缺平台、相对路径、`..`、非文件 MUST fail closed。`boot_driver()` MUST 仍使用 `missing_executable()`。

#### Scenario: declared platform path resolves to a real executable

- **WHEN** 临时制品树在 `platforms[currentPlatform]` 放有可执行文件
- **AND** 调用 `resolve_process_entry_path`
- **THEN** 返回该绝对路径
- **AND** `claude_process_driver_for` MUST 用该路径构造 handshake driver

#### Scenario: missing declared executable fails closed

- **WHEN** Manifest 声明了当前平台路径但文件不存在
- **THEN** `resolve_process_entry_path` MUST 失败
- **AND** `claude_process_driver_for` MUST 回落到 `missing_executable()`
- **AND** `boot_driver()` MUST 不受影响

### Requirement: Host-owned Claude Process Entry MUST complete MXPC handshake

用 Manifest 解析出的 Process Entry 激活 `com.mossx.engine.claude` 时，Restricted Process MUST 完成 framed stdio MXPC handshake。成功后 slot MUST 为 `Ready` 且 driver 持有 1 个 live child。`interrupt` MUST 杀进程组并回 `Idle`；`uninstall` MUST 杀进程组并进 `Uninstalled`。本路径 MUST NOT 调用生产 `engine::claude` spawn。

#### Scenario: activate then interrupt a Manifest-resolved peer

- **WHEN** Host enabled 且 driver 来自 Manifest 解析出的 Process Entry
- **AND** 激活 Claude unit
- **THEN** slot MUST 为 `Ready`，live child MUST 为 1
- **AND** `interrupt` 后 live child MUST 为 0 且 slot MUST 为 `Idle`
- **AND** 可再次 activate 得到更大的 generation
