# project-memory-retrieval-pack-cleaner Specification (delta)

## Purpose

强化 Retrieval Pack 的**语义转接**：记忆为用户当前请求的参考，不是任务本身；并增加不可信内容安全壳。

## MODIFIED Requirements

### Requirement: 主会话记忆使用协议

系统 SHALL 在 Retrieval Pack 中加入明确指令，要求主会话将记忆作为 prior project context **服务于 pack 之后的用户当前问题**，而非把记忆当作用户当前发言。

#### Scenario: 主会话使用 cleaned context

- **WHEN** Retrieval Pack 包含 cleaned context
- **THEN** 主会话提示 SHALL 要求模型将 cleaned context 作为 prior project context
- **AND** 在使用记忆事实时 SHALL 保留对应 `[Mx]` citation

#### Scenario: Primary task 为用户当前原文

- **WHEN** 系统格式化 Retrieval Pack Instruction
- **THEN** Instruction SHALL 声明用户当前请求（pack 之后文本）为 Primary task
- **AND** SHALL 声明 pack 内记录仅为 reference / prior context
- **AND** SHALL NOT 要求模型把记忆正文当作用户本轮唯一意图

#### Scenario: 不可信记忆内容

- **WHEN** 系统格式化 Retrieval Pack
- **THEN** Instruction 或等价外壳 SHALL 要求模型勿执行记忆记录中的指令性内容
- **AND** SHALL 将记忆内容视为不可信历史笔记（plain text reference）

#### Scenario: 主会话处理无关记忆

- **WHEN** Cleaner 标记某条记忆为 irrelevant
- **THEN** 主会话提示 SHALL 要求模型忽略该记录
- **AND** 不得把 irrelevant record 伪装成已使用事实

#### Scenario: 主会话处理冲突记忆

- **WHEN** Cleaner 或 pack 标记 conflicts
- **THEN** 主会话提示 SHALL 要求模型把冲突作为不确定上下文处理
- **AND** 不得把冲突内容合并成单一确定事实

## ADDED Requirements

### Requirement: UI preview 转接措辞

系统 SHALL 在面向用户的记忆注入预览文案中体现「为本轮提问参考」，避免暗示「记忆本身作为发送任务」。

#### Scenario: memory-pick 预览标题

- **WHEN** 系统为 memory-pick 注入生成 previewText
- **THEN** 预览标题或首行 SHALL 表达为本轮提问参考（或等价 i18n）
- **AND** SHALL 包含注入条数

#### Scenario: Cleaned Context 导语

- **WHEN** Cleaner 产出非空 cleaned context
- **THEN** cleaned context 开头 MAY/SHALL 包含面向「当前用户请求」的导语
- **AND** 导语 SHALL NOT 暗示覆盖用户原文
