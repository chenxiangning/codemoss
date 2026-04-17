# opencode-engine Specification (Delta)

MODIFIED by change: opencode-non-streaming-resilience

## Purpose

定义 OpenCode 在非流式输出场景下的等待可见性、超时预警、终态收敛与提供方状态稳定性契约，覆盖心跳驱动等待提示、超时前预警信号、缺失终态事件兜底收敛，以及 provider 抖动下的可用性保护策略。

## Requirements

### Requirement: OpenCode Non-Streaming UX Hint (MODIFIED)

OpenCode UI MUST provide a **dynamic** waiting state driven by backend heartbeat events when a selected model returns
delayed single-chunk output.

**Previous**: UI 仅需在等待超过短阈值后展示静态提示。

**Modified**: UI MUST 消费 `ProcessingHeartbeat` 事件展示动态状态（处理中动画、elapsed time 实时计数、模型名称），而非静态文案。

#### Scenario: long first-chunk wait under opencode (UPDATED)

- **GIVEN** current engine is `opencode`
- **AND** a turn is in processing state without assistant chunk after the latest user message
- **WHEN** wait duration exceeds a short threshold
- **THEN** UI MUST show a dynamic waiting state with:
    - Processing animation (pulse/breathing effect)
    - Elapsed time counter (updated every second via frontend interval)
    - Current model name hint (from heartbeat event or session context)
- **AND** this waiting state MUST be backed by `ProcessingHeartbeat` events for liveness confirmation
- **AND** this hint MUST NOT appear on non-OpenCode engines

#### Scenario: waiting state transitions to content on first text delta (NEW)

- **GIVEN** UI is showing dynamic waiting state
- **WHEN** first `text:delta` event arrives
- **THEN** waiting state MUST immediately transition to normal message rendering
- **AND** local timer and liveness tracking MUST be cleaned up

### Requirement: OpenCode Terminal Completion Robustness (MODIFIED)

OpenCode turn lifecycle MUST complete promptly even when CLI omits terminal events for short replies. **Additionally**,
the system MUST emit a pre-timeout warning signal before hard timeout fires.

**Previous**: 仅覆盖后端超时兜底（quiesced_without_terminal / idle timeout）。

**Modified**: 补充 TimeoutWarning 信号语义——在 idle_timeout 的 80% 时间点向前端发送预警事件，给用户决策窗口（继续等待/取消）。

#### Scenario: response text exists but no explicit turn_complete event (UNCHANGED)

- **GIVEN** OpenCode has emitted assistant text deltas
- **AND** there are no active tool calls
- **WHEN** stream stays idle past a short post-response grace window
- **THEN** backend MUST close the turn as completed (OpenCode-only)
- **AND** MUST NOT block until the global idle timeout.

#### Scenario: pre-timeout warning before idle timeout fires (NEW)

- **GIVEN** OpenCode turn is in processing state
- **AND** elapsed time has reached 80% of the effective idle timeout
- **WHEN** backend detects this threshold in the IO poll timeout branch
- **THEN** backend MUST emit a one-time `TimeoutWarning` event
- **AND** frontend MUST display an actionable warning with cancel option
- **AND** this MUST NOT alter the existing timeout mechanism behavior

### Requirement: OpenCode Dead Code Forward Compatibility (NEW)

OpenCode event parser MUST retain delta-type event handlers for forward compatibility even when current CLI does not
emit them.

#### Scenario: delta handlers preserved with documentation

- **GIVEN** `parse_opencode_event` contains handlers for `content_delta`, `text_delta`, `output_text_delta`,
  `assistant_message_delta`, `message_delta`
- **AND** current CLI `run --format json` mode does not emit these event types
- **WHEN** codebase is reviewed or maintained
- **THEN** these handlers MUST NOT be deleted
- **AND** each handler MUST carry a comment indicating it is reserved for potential CLI streaming mode
- **AND** the comment MUST clarify that current CLI only emits complete `"text"` events

### Requirement: OpenCode Provider Status Stability (NEW)

OpenCode UI MUST avoid single-sample provider health failures causing hard disconnected state and send blocking.

#### Scenario: transient provider check failure does not hard-fail immediately

- **GIVEN** Provider status is currently `is-ok`
- **AND** a single provider health probe fails
- **WHEN** failure count is below configured threshold
- **THEN** UI MUST downgrade to `is-runtime` instead of `is-fail`
- **AND** composer send path MUST remain available

#### Scenario: active session keeps provider status at least runtime

- **GIVEN** provider health probe indicates disconnected
- **AND** current thread has active session or active turn
- **WHEN** status is recomputed
- **THEN** provider status MUST be at least `is-runtime`
- **AND** UI MUST NOT present hard disconnected red state for this case

#### Scenario: stable disconnected state blocks send

- **GIVEN** there is no active session/turn
- **AND** provider probes fail continuously beyond threshold
- **WHEN** status is recomputed
- **THEN** provider status MUST become `is-fail`
- **AND** composer send path MAY be blocked with actionable reconnect hint
