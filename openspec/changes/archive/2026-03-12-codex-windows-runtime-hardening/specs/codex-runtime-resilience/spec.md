## ADDED Requirements

### Requirement: Recoverable Codex First-Packet Timeout

Codex `turn/start` 首包等待超时 MUST 被视为可恢复 warning，而不是立即终结当前线程生命周期。

#### Scenario: first packet delay keeps thread recoverable

- **WHEN** Codex `turn/start` 请求超过首包等待阈值
- **AND** app-server 会话仍保持存活
- **THEN** 系统 MUST 将该状态标记为“仍在等待后续 runtime 事件”的可恢复状态
- **AND** 前端 MUST NOT 立即把该线程收口为终态失败

#### Scenario: initialize timeout remains fatal

- **WHEN** Codex app-server 在 initialize 阶段超时或无响应
- **THEN** 系统 MUST 返回明确的致命启动失败
- **AND** MUST NOT 将该失败误报为可恢复首包等待

### Requirement: Late Turn Start Response Reconciliation

Codex runtime MUST 为超时后的晚到 `turn/start` 结果保留恢复路径，避免“先失败后自愈”变成不可解释的分叉行为。

#### Scenario: late turn start response restores active turn

- **WHEN** `turn/start` 请求已经在本地超时
- **AND** 系统随后收到该请求的晚到成功结果
- **THEN** runtime MUST 继续为当前线程恢复 turn 关联
- **AND** 前端 MUST 能收到等价于 `turn/started` 的生命周期信号

#### Scenario: late runtime events continue same thread lifecycle

- **WHEN** 首包 warning 之后又收到 `turn/started`、`item/*` 或 `turn/completed`
- **THEN** 系统 MUST 将这些事件路由到原线程
- **AND** MUST NOT 因此前 warning 产生重复线程或永久失败状态

### Requirement: Windows Wrapper Compatibility Diagnostics

Codex runtime MUST 在 Windows `.cmd/.bat` wrapper 场景下提供可执行诊断，并在兼容失败时返回可操作信息。

#### Scenario: doctor reports wrapper and resolution context

- **WHEN** 用户运行 Codex doctor
- **THEN** 结果 MUST 包含解析到的 binary 路径、wrapper 类型、PATH 上下文、代理上下文与 app-server probe 状态
- **AND** 用户 MUST 能区分 GUI 解析结果与普通 `PATH`/`which` 结果

#### Scenario: wrapper probe failure keeps actionable details

- **WHEN** Windows 下解析到的 Codex binary 为 `.cmd` 或 `.bat`
- **AND** `app-server` probe 或 initialize 失败
- **THEN** 系统 MUST 返回明确的 wrapper 兼容诊断
- **AND** MUST 提供可操作线索，而不是只给出模糊的网络错误

### Requirement: Codex-Only Recovery Boundary

本 capability 的首包恢复语义 MUST 仅作用于 Codex 运行时，不得改变 Claude/OpenCode 现有 turn 生命周期契约。

#### Scenario: non-codex engines bypass codex recovery contract

- **WHEN** 当前线程不属于 Codex 引擎
- **THEN** 系统 MUST NOT 应用 Codex 首包恢复语义
- **AND** 非 Codex 引擎现有发送/收口路径 MUST 保持不变
