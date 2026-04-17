## MODIFIED Requirements

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

#### Scenario: waiting hint copy uses i18n keys

- **GIVEN** 前端展示 OpenCode 等待提示
- **WHEN** 用户切换界面语言
- **THEN** 等待提示 MUST 随语言同步切换
- **AND** MUST 使用统一 fallback 文案策略

#### Scenario: waiting UI disappears when text arrives

- **GIVEN** 前端正在显示等待 UI
- **WHEN** 收到首个 `text:delta` 或 `item/agentMessage/delta` 事件
- **THEN** 前端 MUST 立即清除等待 UI
- **AND** MUST 清理本地计时器
