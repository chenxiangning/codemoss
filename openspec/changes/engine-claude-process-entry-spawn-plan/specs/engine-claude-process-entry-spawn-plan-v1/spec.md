# engine-claude-process-entry-spawn-plan-v1 Spec Delta

## ADDED Requirements

### Requirement: Production Command MUST project to an auditable SpawnPlan

Core MUST 能把生产 `Command` 的 program / args / cwd 投影为 `SuperviseTarget`。program MUST 为绝对路径、过 allowlist、且是真实文件。cwd 若存在 MUST 为绝对路径且不含 `..`。相对路径、裸 `claude`、shell stem、缺文件、非法 cwd MUST 得到 `None`。

#### Scenario: a production-shaped sleep command maps with argv and cwd

- **WHEN** program 是本机绝对路径（测试用 `/bin/sleep`）、argv 含 `-p`、cwd 是绝对工作区
- **THEN** `spawn_plan_from_command` MUST 返回同等 executable / argv / cwd

#### Scenario: a bare or shell program is denied

- **WHEN** program 是 `claude` 或 `/bin/bash`
- **THEN** `spawn_plan_from_command` MUST 返回 `None`

### Requirement: Dual-run MUST keep a single spawn owner

`MOSSX_CLAUDE_PROCESS_ENTRY` MUST 默认关闭。关闭时产品路径 MUST 仍调用 `cmd.spawn()`。打开时 MUST NOT 调用 `cmd.spawn()`，MUST NOT 经 Process Entry 拉起产品 CLI，MUST 以 `process-entry-spawn-not-cutover` 或 `process-entry-bin-denied` fail closed。boot MUST 不读该 flag。

#### Scenario: flag off keeps Core as the only spawn owner

- **WHEN** 环境未设置 `MOSSX_CLAUDE_PROCESS_ENTRY`
- **THEN** `decide_claude_spawn_owner` MUST 为 `CoreCommand`

#### Scenario: flag on refuses a second owner

- **WHEN** `MOSSX_CLAUDE_PROCESS_ENTRY=1` 且 SpawnPlan 合法
- **THEN** owner MUST 为 `ProcessEntryNotCutover`
- **AND** 产品路径 MUST NOT `cmd.spawn()`
