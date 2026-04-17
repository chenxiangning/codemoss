# conversation-stream-activity-presence Specification

## Purpose

定义会话流式处理中 `waiting/ingress` 相位语义和视觉联动契约，确保消息区与输入区状态反馈一致且跨引擎可预测。

## Requirements

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

### Requirement: Motion and Theme Adaptation MUST Remain Recoverable

系统 MUST 在 reduced-motion 与浅色主题下保持可识别但可降级的状态反馈。

#### Scenario: reduced-motion disables aggressive ingress animation

- **WHEN** 用户系统开启 reduced-motion
- **THEN** 系统 SHOULD 关闭或弱化 ingress 动画粒子/光晕
- **AND** MUST 保留可读状态指示

#### Scenario: light theme keeps ingress feedback visible

- **WHEN** 应用处于浅色主题
- **THEN** ingress 视觉反馈 MUST 保持可见对比度
- **AND** 不得与 waiting 态不可区分
