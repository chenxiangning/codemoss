# engine-claude-askuser-facade-v1 Spec Delta

## ADDED Requirements

### Requirement: AskUser MCP and resume diagnostics MUST go through EngineManager

`lib.rs` 启动 AskUser MCP MUST 调用 `EngineManager::claude_ask_lookup`。`state.rs` MUST 调用 `set_claude_ask_user_question_resume_diagnostic_sink`。MUST NOT 在这两处直打 `claude_manager`。MUST NOT 删除 `engine/claude*`。

#### Scenario: GUI boot uses the manager lookup handle

- **WHEN** 检查 `lib.rs` 的 AskUser MCP 启动
- **THEN** MUST 包含 `claude_ask_lookup`
- **AND** MUST NOT 包含 `claude_manager.clone`

#### Scenario: diagnostic sink uses the manager entry

- **WHEN** 检查 `state.rs` 的 resume diagnostic 注册
- **THEN** MUST 包含 `set_claude_ask_user_question_resume_diagnostic_sink`
- **AND** MUST NOT 包含 `claude_manager.set_ask_user_question_resume_diagnostic_sink`
