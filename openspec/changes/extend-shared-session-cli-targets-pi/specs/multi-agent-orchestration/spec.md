## ADDED Requirements

### Requirement: Collab host and stage targets MUST share the Shared engine set

Multi-Agent 协作的 host CLI 与每个 stage target MUST 与
`SHARED_SESSION_SUPPORTED_ENGINES` / `is_supported_shared_session_engine`
同集。系统 MUST NOT 再维护一份独立的五引擎白名单。PI CLI 进 Shared 后
MUST 可启用协作；Gemini MUST 继续 fail-closed。

#### Scenario: Shared Pi session can arm collaboration

- **WHEN** 当前 Shared Session 的 Atomic target engine 是 `pi`
- **THEN** Composer 协作 pill MUST 可点击
- **AND** `isMultiAgentTargetSupported("pi")` MUST 为 true
- **AND** 用户选择已配齐模板并启用协作后，下次发送 MUST 走编排而不是保持「协作 · 未开启」

#### Scenario: backend accepts Pi as a collab target

- **WHEN** 协作启动 run 或校验某个 stage binding 的 `ExecutionTarget.engine` 为 `Pi`
- **THEN** `validate_agent_target` MUST 返回 Ok
- **AND** MUST NOT 返回 `agent-target-unavailable`

#### Scenario: Gemini remains unavailable for collab

- **WHEN** host 或 stage target engine 为 `gemini`
- **THEN** 协作 pill MUST 保持 disabled
- **AND** `validate_agent_target` MUST 返回以 `agent-target-unavailable:` 为前缀的错误

#### Scenario: template editor resolves Pi local sentinel

- **WHEN** 用户在协作模板管理中把某环节引擎设为 PI CLI
- **THEN** `StageTargetPicker` MUST 使用 `__local_pi__` 作为 local Provider sentinel
- **AND** 配齐 model 后该环节 MUST 视为可选用，不得永久停在「待配齐」
