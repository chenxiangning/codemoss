## ADDED Requirements

### Requirement: Streaming Activity Phase MUST Expose Waiting and Ingress States

系统 MUST 在流式处理中暴露 `waiting` 与 `ingress` 相位，用于统一消息区与输入区反馈。

#### Scenario: no new chunk keeps waiting phase

- **WHEN** 会话处于 processing 且最新对话指纹未变化
- **THEN** 相位 MUST 为 `waiting`
- **AND** 相应 UI MUST 使用 waiting 视觉反馈

#### Scenario: new chunk switches to ingress phase then decays

- **WHEN** 会话指纹发生变化（收到新流式片段）
- **THEN** 相位 MUST 进入 `ingress`
- **AND** 在保持窗口结束后 MUST 回落到 `waiting`

### Requirement: Stream Activity Effects MUST Be Consistent Across Codex/Claude/Gemini

Codex/Claude/Gemini MUST 共享同一相位语义与视觉联动策略。

#### Scenario: working indicator and stop button share same phase class

- **WHEN** 引擎为 `codex/claude/gemini`
- **THEN** 消息区 working indicator 与输入区 stop 按钮 MUST 使用一致相位类名
- **AND** 两处状态切换 MUST 同步

#### Scenario: unsupported engines fall back to idle

- **WHEN** 引擎不在上述集合（例如 OpenCode）
- **THEN** 系统 MUST 回退到 `idle` 表现
- **AND** MUST NOT 注入 waiting/ingress 特效类
