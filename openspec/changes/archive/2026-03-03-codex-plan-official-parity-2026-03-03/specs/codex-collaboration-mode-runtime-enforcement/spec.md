## ADDED Requirements

### Requirement: Collaboration Policy Profile Selection

系统 MUST 为 Codex 协作模式策略提供 profile 选择，并将默认 profile 设为官方兼容语义。

#### Scenario: official-compatible is default profile

- **WHEN** 系统在未显式配置 profile 的情况下启动 Codex 通道
- **THEN** 有效 profile MUST 为 `official-compatible`
- **AND** MUST 记录当前 profile 供可观测与回归审计

#### Scenario: strict-local profile remains available for controlled rollout

- **WHEN** 运维或实验配置启用 `strict-local`
- **THEN** 系统 MUST 启用本地增强阻断策略
- **AND** 该策略 MUST 仅作用于 Codex 通道

## MODIFIED Requirements

### Requirement: Effective Collaboration Mode Resolution

系统 MUST 在 Codex 消息发送链路中计算并输出线程级 `effective_mode`，并将 UI 模式 `default` 规范映射为运行时 `code`。

#### Scenario: explicit mode resolves to effective mode

- **GIVEN** 用户在 Codex 会话中显式选择 `plan` 或 `default`
- **WHEN** 系统发起 `turn/start`
- **THEN** 系统 MUST 计算 `effective_mode`
- **AND** `default` MUST 解析为 `effective_mode=code`

#### Scenario: missing or invalid mode falls back deterministically

- **GIVEN** 请求中的协作模式缺失或非法
- **WHEN** 系统计算协作模式
- **THEN** 系统 MUST 回退到确定性默认模式
- **AND** MUST 记录 `fallback_reason`

### Requirement: Mode-Aware RequestUserInput Enforcement

系统 MUST 根据策略 profile 决定 `requestUserInput` 的处理方式，并保证行为可观测。

#### Scenario: official-compatible keeps request user input flow

- **GIVEN** 当前 profile 为 `official-compatible`
- **WHEN** 系统收到 `item/tool/requestUserInput`
- **THEN** 系统 MUST 保持标准交互提问流程
- **AND** MUST NOT 因 `effective_mode=code` 自动阻断

#### Scenario: strict-local blocks request user input flow in code mode

- **GIVEN** 当前 profile 为 `strict-local`
- **AND** 当前线程 `effective_mode=code`
- **WHEN** 系统收到 `item/tool/requestUserInput`
- **THEN** 系统 MUST 阻断该事件进入交互卡片流程
- **AND** MUST 发出标准化阻断提示事件

#### Scenario: plan mode preserves request user input flow in all profiles

- **GIVEN** 当前线程 `effective_mode=plan`
- **WHEN** 系统收到 `item/tool/requestUserInput`
- **THEN** 系统 MUST 保持现有交互提问流程
- **AND** MUST NOT 误触发阻断提示
