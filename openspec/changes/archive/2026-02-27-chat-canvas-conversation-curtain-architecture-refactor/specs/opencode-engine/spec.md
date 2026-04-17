## MODIFIED Requirements

### Requirement: OpenCode Non-Streaming UX Hint (MODIFIED)

OpenCode UI MUST 提供由 heartbeat 驱动的动态等待态，并且该等待态 MUST 作为展示层提示，不得引入新的会话语义类型。

#### Scenario: long first-chunk wait under opencode

- **GIVEN** current engine is `opencode`
- **AND** a turn is in processing state without assistant chunk after the latest user message
- **WHEN** wait duration exceeds a short threshold
- **THEN** UI MUST show dynamic waiting state（动画 + elapsed time + 模型提示）
- **AND** waiting state MUST be backed by `ProcessingHeartbeat` events for liveness confirmation

#### Scenario: waiting state transitions to content on first text delta

- **GIVEN** UI is showing dynamic waiting state
- **WHEN** first `text:delta` event arrives
- **THEN** waiting state MUST immediately transition to normal message rendering
- **AND** local timer and liveness tracking MUST be cleaned up

#### Scenario: waiting hint is presentation-only

- **WHEN** OpenCode heartbeat waiting hint is rendered
- **THEN** hint MUST be injected via presentation profile or equivalent display layer
- **AND** it MUST NOT change `ConversationItem.kind` semantics or ordering

### Requirement: OpenCode Terminal Completion Robustness (MODIFIED)

OpenCode turn 生命周期 MUST 在缺失显式 terminal 事件时保持可收敛，并在统一装配链路下保持实时与历史语义一致。

#### Scenario: response text exists but no explicit turn_complete event

- **GIVEN** OpenCode has emitted assistant text deltas
- **AND** there are no active tool calls
- **WHEN** stream stays idle past a short post-response grace window
- **THEN** backend MUST close the turn as completed (OpenCode-only)
- **AND** MUST NOT block until the global idle timeout

#### Scenario: pre-timeout warning before idle timeout fires

- **GIVEN** OpenCode turn is in processing state
- **AND** elapsed time has reached 80% of the effective idle timeout
- **WHEN** backend detects this threshold in the IO poll timeout branch
- **THEN** backend MUST emit a one-time `TimeoutWarning` event
- **AND** frontend MUST display actionable warning with cancel option

#### Scenario: historical replay keeps terminal semantics

- **GIVEN** OpenCode turn 在实时阶段通过鲁棒收敛逻辑结束
- **WHEN** 用户在历史会话中回放该 turn
- **THEN** 该 turn 的完成态 MUST 与实时一致
- **AND** 不得因历史 loader 差异重建为 pending 或 failed
