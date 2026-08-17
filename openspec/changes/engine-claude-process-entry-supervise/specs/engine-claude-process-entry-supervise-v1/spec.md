# engine-claude-process-entry-supervise-v1 Spec Delta

## ADDED Requirements

### Requirement: Process Entry MUST supervise a CLI only through closed MXPC

Handshake 成功后，Claude Process Entry MUST 只接受 `mossx.process.supervise`。`executable` MUST 为绝对路径、过 allowlist、且是真实文件。shell / node / python 等 stem、相对路径、`..`、缺文件 MUST fail closed。未知 method MUST 返回 JSON-RPC error，且 MUST NOT spawn。

#### Scenario: a declared sleep executable is supervised after handshake

- **WHEN** Host 用 Manifest 解析出的 Process Entry 激活 Claude unit
- **AND** driver 配置 supervise `/bin/sleep`（或 Windows `timeout.exe`）
- **THEN** slot MUST 为 `Ready`
- **AND** Process Entry leader 下 MUST 存在被监督子进程

#### Scenario: a shell executable is rejected

- **WHEN** supervise 目标是 `/bin/bash` 或同等 shell stem
- **THEN** activate MUST 失败
- **AND** live Process Entry child MUST 为 0

### Requirement: interrupt and uninstall MUST kill the supervised CLI process group

被监督 CLI MUST 与 Process Entry 同进程组。`interrupt` MUST 杀组并回 `Idle`。`uninstall` MUST 杀组并进 `Uninstalled`。之后 MUST 探测不到该组残留进程。本路径 MUST NOT 调用生产 `engine::claude` spawn。

#### Scenario: interrupt clears the supervised grandchild

- **WHEN** Process Entry 已 supervise 一个长驻 CLI
- **AND** Host `interrupt` 当前 generation
- **THEN** live child MUST 为 0
- **AND** 被监督 CLI MUST 不再存在
