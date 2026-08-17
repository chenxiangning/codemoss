# engine-claude-process-entry-resume-gate-v1 Spec Delta

## ADDED Requirements

### Requirement: Flag-on resume MUST NOT spawn a second Core child

`MOSSX_CLAUDE_PROCESS_ENTRY` 打开时，`handle_file_approval_resume` 与 `handle_ask_user_question_resume` MUST 在 `cmd.spawn()` 之前失败，MUST 杀掉已有 Process Entry generation，MUST 返回 `process-entry-resume-not-cutover`。flag 关闭时 MUST 仍调用 `cmd.spawn()`。

#### Scenario: flag on refuses both resume spawn sites

- **WHEN** `MOSSX_CLAUDE_PROCESS_ENTRY=1` 且 resume 已拿到 session_id
- **THEN** 两条 resume MUST NOT 调用 `cmd.spawn()`
- **AND** 错误码 MUST 为 `process-entry-resume-not-cutover`

#### Scenario: flag off keeps Core resume spawn

- **WHEN** 环境未设置该 flag
- **THEN** `user_input.rs` MUST 仍包含两处 `cmd.spawn()`
