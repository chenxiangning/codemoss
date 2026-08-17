# engine-claude-process-entry-turn-handle-v1 Spec Delta

## ADDED Requirements

### Requirement: Flag-on send_message MUST spawn through Process Entry, not cmd.spawn

`spawn_claude_turn` MUST 在 `MOSSX_CLAUDE_PROCESS_ENTRY` 关闭时走 Core `Command::spawn`。打开且 SpawnPlan 与 Process Entry 都合法时 MUST Host activate `claude-cli` 并 supervise 该 plan，MUST NOT 调用产品 `cmd.spawn()`。缺 plan 或缺 Process Entry MUST fail closed。

#### Scenario: flag off still uses a Core child

- **WHEN** 环境未设置 `MOSSX_CLAUDE_PROCESS_ENTRY`
- **THEN** `spawn_claude_turn` MUST 返回 `CoreChild`

#### Scenario: flag on supervises a real CLI through Process Entry

- **WHEN** flag 打开且 Process Entry 与 `/bin/sleep` plan 合法
- **THEN** handle MUST 为 `ProcessEntry`
- **AND** interrupt MUST 清 live child

### Requirement: A Process Entry turn without a cutover line source MUST be killed

若 spawn 已切到 Process Entry 而行源仍不是 cursor，调用方 MUST interrupt 该 generation，MUST 返回 `process-entry-lines-not-cutover`，MUST NOT 留下 CLI。默认 `send_message` 在 flag off 时 MUST 仍 `cmd.spawn()` + `lines.next_line()`。

#### Scenario: flag on refuses to read a Core child that was never spawned

- **WHEN** Process Entry handle 已建立且 `decide_claude_line_source` 仍不是 cursor
- **THEN** 该 turn MUST 被 interrupt
- **AND** 错误码 MUST 为 `process-entry-lines-not-cutover`
