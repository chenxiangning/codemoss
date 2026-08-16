# Design

门面只转调 Core `get_session_for_provider` / `session_for_turn`。`EngineManager::interrupt_claude_turn` 复用现有 provider / turn 查找规则，再 `interrupt_turn`。产品 / daemon 不再直打 `claude_manager`。flag off 时行为不变。
