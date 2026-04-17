# opencode-timeout-prewarning Specification

ADDED by change: opencode-non-streaming-resilience

## Purpose

在 OpenCode 会话即将达到超时阈值前，后端发送一次预警事件，前端展示 actionable 提示（继续等待/取消），给用户决策窗口而非突然超时失败。

## Requirements

### Requirement: Backend Timeout Warning Emission

后端 MUST 在已用时间达到模型超时阈值 80% 时发射一次 TimeoutWarning 事件。

#### Scenario: timeout warning emitted at 80% threshold

- **GIVEN** OpenCode `send_message` 主循环正在运行
- **AND** 当前生效的 idle timeout 为 `T` 秒（当前统一策略为 300s）
- **AND** `timeout_warning_emitted == false`
- **WHEN** `started_at.elapsed() >= T * 0.8`
- **THEN** 后端 MUST 发射 `EngineEvent::TimeoutWarning` 事件
- **AND** 事件 MUST 携带 `elapsed_secs`（已用秒数）
- **AND** 事件 MUST 携带 `timeout_secs`（超时阈值秒数）
- **AND** 事件 MAY 携带 `model_hint`
- **AND** `timeout_warning_emitted` MUST 被设为 `true`

#### Scenario: timeout warning emitted only once per turn

- **GIVEN** `timeout_warning_emitted == true`
- **WHEN** IO poll 超时再次发生
- **THEN** 后端 MUST NOT 重复发射 TimeoutWarning 事件

#### Scenario: timeout warning follows unified timeout policy

- **GIVEN** OpenCode 采用统一 idle timeout 策略
- **WHEN** idle timeout 为 300s
- **THEN** TimeoutWarning MUST 在约 240s（300 * 0.8）时发射
- **AND** 事件的 `timeout_secs` MUST 为 300

#### Scenario: timeout warning is OpenCode-only

- **GIVEN** 当前引擎是 Claude 或 Codex
- **WHEN** turn 接近超时
- **THEN** 系统 MUST NOT 发射 TimeoutWarning 事件

### Requirement: TimeoutWarning Event Schema

TimeoutWarning 事件 MUST 作为 EngineEvent 枚举变体存在。

#### Scenario: event converts to AppServerEvent correctly

- **GIVEN** `EngineEvent::TimeoutWarning` 被发射
- **WHEN** `engine_event_to_app_server_event` 处理该事件
- **THEN** 输出的 JSON-RPC method MUST 为 `"processing/timeoutWarning"`
- **AND** params MUST 包含 `threadId`、`elapsedSecs`、`timeoutSecs`

#### Scenario: timeout warning is not terminal

- **GIVEN** `EngineEvent::TimeoutWarning` 实例
- **WHEN** 调用 `is_terminal()`
- **THEN** MUST 返回 `false`

### Requirement: Frontend Timeout Warning UI

前端 MUST 在收到 TimeoutWarning 时展示 actionable 预警条。

#### Scenario: warning bar appears on timeout warning event

- **GIVEN** 前端处于 OpenCode 等待状态
- **WHEN** 收到 `processing/timeoutWarning` 事件
- **THEN** 前端 MUST 显示预警条
- **AND** 预警条 MUST 包含描述文案（如"模型响应较慢，你可以继续等待或取消重试"）
- **AND** 预警条 MUST 包含「取消」操作按钮

#### Scenario: cancel button triggers interrupt

- **GIVEN** 超时预警条正在显示
- **WHEN** 用户点击「取消」按钮
- **THEN** 前端 MUST 调用 OpenCode interrupt 路径
- **AND** 等待 UI 和预警条 MUST 被清除

#### Scenario: warning bar dismissed on text arrival

- **GIVEN** 超时预警条正在显示
- **WHEN** 收到 `text:delta` 或 `turn:completed` 事件
- **THEN** 预警条 MUST 自动消失

#### Scenario: warning does not appear for non-opencode engines

- **GIVEN** 当前引擎不是 `opencode`
- **WHEN** 任何事件到达
- **THEN** 前端 MUST NOT 渲染超时预警条
