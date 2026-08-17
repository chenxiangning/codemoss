# engine-claude-process-entry-map-bin-v1 Spec Delta

## ADDED Requirements

### Requirement: Production claudeBin MUST map to supervise only when auditable

`map_claude_bin_to_supervise` MUST 只接受绝对路径、过 allowlist、且是真实文件的 `claudeBin`。空字符串、相对路径、`..`、shell / node / python stem、缺文件 MUST 返回 `None`。MUST NOT fallback 到 PATH 上的裸 `claude`。

#### Scenario: an absolute sleep binary maps to supervise

- **WHEN** `claudeBin` 是本机存在的绝对路径（测试用 `/bin/sleep` 或 `timeout.exe`）
- **THEN** `map_claude_bin_to_supervise` MUST 返回该路径的 `SuperviseTarget`

#### Scenario: empty or shell claudeBin maps to nothing

- **WHEN** `claudeBin` 为空、相对路径或 `/bin/bash`
- **THEN** `map_claude_bin_to_supervise` MUST 返回 `None`

### Requirement: Mapped driver MUST stay off the product spawn path

`claude_process_driver_for_bin` MUST 在 Process Entry 与 `claudeBin` 都合法时构造 handshake + supervise driver。任一缺失 MUST 回落 `missing_executable()`。`boot_driver()` 与 `ClaudeSession::resolve_cli_binary` / 生产 `Command::spawn` MUST 不被本映射替换。

#### Scenario: mapped driver activates without touching production spawn

- **WHEN** 临时制品树有 Process Entry 且 `claudeBin` 合法
- **THEN** activate MUST `Ready`，interrupt MUST 清 child
- **AND** `engine/claude.rs` MUST 仍包含 `resolve_cli_binary` 与 `cmd.spawn`
- **AND** `boot.rs` MUST 不含 `claude_process_driver_for_bin`
