# engine-claude-process-entry-resume-spawn-v1 Spec Delta

## ADDED Requirements

### Requirement: Flag-on resume MUST respawn through Process Entry

`MOSSX_CLAUDE_PROCESS_ENTRY` 打开时，approval / AskUser resume MUST 先 interrupt 旧 generation，再 `spawn_process_entry_turn`，MUST NOT 调用 `cmd.spawn()`。成功后 MUST 把新句柄写入 session，MUST 让调用方继续走 cursor。flag 关闭时 MUST 仍 `cmd.spawn()`。

#### Scenario: flag on resume supervises a new CLI

- **WHEN** flag 打开且 resume plan 为合法 `/bin/sleep`
- **THEN** 新 handle MUST 为 Process Entry
- **AND** 旧 live child MUST 已清

#### Scenario: flag off keeps Core resume spawn

- **WHEN** 环境未设置该 flag
- **THEN** `user_input.rs` MUST 仍包含两处 `cmd.spawn()`
