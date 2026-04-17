# opencode-processing-heartbeat Specification

ADDED by change: opencode-non-streaming-resilience

## Purpose

Rust 后端在 OpenCode CLI 无 stdout 输出期间向前端发送周期性心跳事件，携带 elapsed/timeout 元数据。前端消费心跳展示动态处理状态，消除
LLM 批量输出模式下的"假死"感知。

## ADDED Requirements

### Requirement: Backend Heartbeat Emission During CLI Silence

后端 MUST 在 OpenCode CLI 无输出期间周期性发送 ProcessingHeartbeat 事件。

#### Scenario: heartbeat emitted when CLI produces no output and no text received

- **GIVEN** OpenCode `send_message` 主循环正在运行
- **AND** `text_delta_count == 0`（尚未收到首个 text 事件）
- **AND** `active_tool_calls <= 0`
- **AND** `saw_turn_completed == false`
- **WHEN** IO poll 超时（`OPENCODE_IO_POLL_INTERVAL` 到期，无 stdout 行）
- **THEN** 后端 MUST 通过 `emit_turn_event` 发射 `EngineEvent::ProcessingHeartbeat` 事件
- **AND** 事件 MUST 携带 `elapsed_secs`（从 `started_at` 起计的秒数）
- **AND** 事件 MUST 携带 `timeout_secs`（当前生效的 `model_idle_timeout` 秒数）
- **AND** 事件 MAY 携带 `model_hint`（当前请求的模型标识）

#### Scenario: heartbeat stops after first text delta received

- **GIVEN** 后端正在发射 ProcessingHeartbeat 事件
- **WHEN** 首个 `"text"` 事件从 CLI stdout 到达（`text_delta_count` 从 0 变为 1）
- **THEN** 后端 MUST 停止发射 ProcessingHeartbeat 事件
- **AND** 后续 IO poll 超时 MUST NOT 再次发射心跳

#### Scenario: heartbeat stops when tool call starts

- **GIVEN** 后端正在发射 ProcessingHeartbeat 事件
- **WHEN** 收到 tool_use started 事件（`active_tool_calls` 从 0 变为 1）
- **THEN** 后端 MUST 停止发射 ProcessingHeartbeat 事件

#### Scenario: heartbeat is OpenCode-only

- **GIVEN** 当前引擎是 Claude 或 Codex
- **WHEN** turn 正在处理
- **THEN** 系统 MUST NOT 发射 ProcessingHeartbeat 事件
- **AND** Claude/Codex 引擎路径 MUST 保持完全不变

### Requirement: ProcessingHeartbeat Event Schema

ProcessingHeartbeat 事件 MUST 作为 EngineEvent 枚举变体存在，并通过统一事件管线传递。

#### Scenario: event converts to AppServerEvent correctly

- **GIVEN** `EngineEvent::ProcessingHeartbeat` 被发射
- **WHEN** `engine_event_to_app_server_event` 处理该事件
- **THEN** 输出的 JSON-RPC method MUST 为 `"processing/heartbeat"`
- **AND** params MUST 包含 `threadId`、`elapsedSecs`、`timeoutSecs`
- **AND** params MAY 包含 `modelHint`

#### Scenario: heartbeat is not terminal

- **GIVEN** `EngineEvent::ProcessingHeartbeat` 实例
- **WHEN** 调用 `is_terminal()`
- **THEN** MUST 返回 `false`

### Requirement: Frontend Waiting State Rendering

前端 MUST 在 OpenCode turn 处理期间展示动态等待 UI。

#### Scenario: waiting UI appears on turn start for opencode engine

- **GIVEN** 当前引擎是 `opencode`
- **AND** 用户刚发送消息（turn:started 已收到）
- **AND** 尚未收到任何 `text:delta` 事件
- **WHEN** 等待开始
- **THEN** 前端 MUST 显示处理中动画（脉冲/呼吸灯效果）
- **AND** MUST 显示已等待时长（秒级实时计数）
- **AND** SHOULD 显示当前模型名称

#### Scenario: waiting UI updates with heartbeat liveness

- **GIVEN** 前端正在显示等待 UI
- **WHEN** 收到 `processing/heartbeat` 事件
- **THEN** 前端 MUST 更新 liveness 状态（确认后端仍在正常等待）
- **AND** 前端 MAY 更新已等待时长（与前端本地计时器 reconcile）

#### Scenario: waiting UI disappears when text arrives

- **GIVEN** 前端正在显示等待 UI
- **WHEN** 收到首个 `text:delta` 或 `item/agentMessage/delta` 事件
- **THEN** 前端 MUST 立即清除等待 UI
- **AND** MUST 清理本地计时器

#### Scenario: waiting UI disappears on turn complete or error

- **GIVEN** 前端正在显示等待 UI
- **WHEN** 收到 `turn:completed` 或 `turn:error` 事件
- **THEN** 前端 MUST 立即清除等待 UI

#### Scenario: waiting UI does not appear for non-opencode engines

- **GIVEN** 当前引擎不是 `opencode`
- **WHEN** turn 正在处理且无 text 到达
- **THEN** 前端 MUST NOT 显示 heartbeat 驱动的等待 UI
- **AND** 现有行为 MUST 保持不变

### Requirement: Frontend Liveness Detection

前端 MUST 能检测后端心跳是否中断。

#### Scenario: liveness warning when heartbeats stop

- **GIVEN** 前端正在显示等待 UI
- **AND** 已经收到过至少一次 `processing/heartbeat`
- **WHEN** 连续 15 秒未收到新的心跳事件
- **AND** 也未收到任何其他 turn 事件
- **THEN** 前端 SHOULD 在等待 UI 中增加"连接可能中断"的辅助提示
- **AND** 该提示 MUST NOT 替代等待 UI 本身
