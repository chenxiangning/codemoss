# engine-claude-runtime-driver-v1 Spec Delta

## ADDED Requirements

### Requirement: RestrictedProcessDriver MUST support an auditable real-executable path

`RestrictedProcessDriver` MUST 能从显式注入的可执行文件路径构造，该路径 MUST 来自可审计来源（engine config 或 settings 的 `claudeBin`），而非隐式硬编码。`boot_driver()` MUST 保持 `missing_executable()`（default-off 安全闸门），MUST NOT 在 boot 路径指向真实可执行文件。

#### Scenario: driver accepts an explicit executable path

- **WHEN** 用显式可执行文件路径构造 `RestrictedProcessDriver`
- **THEN** `spawn_child` 在路径为真实可执行文件时 MUST 走真实 spawn 流程（含 handshake / env 注入）
- **AND** 在路径无效或非文件时 MUST 返回 `DriverError::Crash`

#### Scenario: boot stays default-off

- **WHEN** 检查 `boot_driver()`
- **THEN** MUST 仍使用 `missing_executable()`，MUST NOT 解析真实 `claudeBin`

### Requirement: Real-CLI conformance MUST be an explicit gate before production wiring

真实 CLI 环境的 spawn/handshake 验证 MUST 作为显式验收 gate。在未于真实 CLI 环境验证前，MUST NOT 宣称 stream/interrupt/storage/rollback conformance 通过，MUST NOT 把 `engine/claude.rs` 迁入插件运行时。

#### Scenario: no real-CLI environment means no conformance claim

- **WHEN** 缺少真实 CLI 环境
- **THEN** 本 change MUST 停留在「通路建立 + 边界固化」，不声称产品 conformance 达成
