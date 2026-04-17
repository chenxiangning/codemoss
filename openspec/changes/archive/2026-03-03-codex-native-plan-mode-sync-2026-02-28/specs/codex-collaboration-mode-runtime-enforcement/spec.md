## MODIFIED Requirements

### Requirement: Effective Collaboration Mode Resolution

系统 MUST 在 Codex 消息发送链路中计算线程级 `effective_mode`，并保持用户层与运行时映射一致。

#### Scenario: default maps to runtime code

- **GIVEN** 用户层模式为 `default`
- **WHEN** 系统解析运行时模式
- **THEN** `effective_mode` MUST 为 `code`

#### Scenario: plan maps to runtime plan

- **GIVEN** 用户层模式为 `plan`
- **WHEN** 系统解析运行时模式
- **THEN** `effective_mode` MUST 为 `plan`

## ADDED Requirements

### Requirement: Plan Readonly Enforcement

系统 MUST 在 `effective_mode=plan` 时执行只读硬约束，而不是仅依赖提示词约束。

#### Scenario: plan mode blocks write file operations

- **GIVEN** 当前线程 `effective_mode=plan`
- **WHEN** 发生写文件操作（如 apply_patch 或等效写入工具）
- **THEN** 系统 MUST 阻断该操作
- **AND** MUST 记录阻断原因

#### Scenario: plan mode blocks repo-mutating commands

- **GIVEN** 当前线程 `effective_mode=plan`
- **WHEN** 执行会改变仓库状态的命令
- **THEN** 系统 MUST 阻断该命令
- **AND** MUST 提示切换到 `Default`

#### Scenario: default mode keeps normal execution path

- **GIVEN** 当前线程 `effective_mode=code`
- **WHEN** 执行读写与命令路径
- **THEN** 系统 MUST 按既有审批/沙箱策略允许执行

### Requirement: User-visible Content Hygiene for Mode Policy

模式策略注入 MUST NOT 污染用户可见正文。

#### Scenario: runtime policy does not inject code wording into user-visible message

- **WHEN** 系统为运行时注入模式策略
- **THEN** 用户可见消息正文 MUST NOT 包含 `Collaboration mode: code`
- **AND** 策略信息 SHOULD 保留在系统指令或不可见元数据层
